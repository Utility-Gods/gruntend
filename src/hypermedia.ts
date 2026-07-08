import { Result, type Result as BetterResult } from "better-result";
import type { MaybePromise } from "./tool.ts";

export type HtmlSurfaceEventType = "click" | "submit";

export type HtmlSurfaceFormValues = Record<string, string | string[]>;

export type HtmlSurfaceActionResult = void | BetterResult<unknown, unknown>;

export interface HtmlSurfaceActionSubmission {
  readonly type: HtmlSurfaceEventType;
  readonly values?: HtmlSurfaceFormValues;
}

export interface HtmlSurfaceHydrationOptions {
  readonly submitAction: (
    actionId: string,
    submission: HtmlSurfaceActionSubmission,
  ) => MaybePromise<HtmlSurfaceActionResult>;
  readonly onError?: (error: unknown) => void;
}

export interface HtmlSurfaceHydration {
  dispose(): void;
}

export interface HtmlSurfaceMaterializeOptions<TControl = unknown> {
  readonly html: string;
  readonly controls: Record<string, TControl>;
  readonly mintAction: (control: TControl) => string;
}

export type SemanticActionQuery = Record<string, string | string[]>;

export interface SemanticActionPath {
  readonly path: string;
  readonly segments: readonly string[];
  readonly query: SemanticActionQuery;
}

export interface SemanticActionPathParseError {
  readonly code: "invalid_path";
  readonly message: string;
}

export interface SemanticActionPathMatch {
  readonly path: string;
  readonly pattern: string;
  readonly params: Record<string, string>;
}

export interface SemanticActionPathMatchError {
  readonly code: "not_matched";
  readonly message: string;
}

export type SemanticActionPathParseOutcome = BetterResult<
  SemanticActionPath,
  SemanticActionPathParseError
> & {
  unwrapError(): SemanticActionPathParseError;
};

export type SemanticActionPathMatchOutcome = BetterResult<
  SemanticActionPathMatch,
  SemanticActionPathMatchError
> & {
  unwrapError(): SemanticActionPathMatchError;
};

export interface HtmlSurfaceMaterializeResult {
  readonly html: string;
}

export interface HtmlSurfaceMaterializeError {
  readonly code: "unknown_control";
  readonly message: string;
}

export type HtmlSurfaceMaterializeOutcome = BetterResult<
  HtmlSurfaceMaterializeResult,
  HtmlSurfaceMaterializeError
> & {
  unwrapError(): HtmlSurfaceMaterializeError;
};

interface ElementLike {
  readonly tagName?: string;
  readonly elements?: ArrayLike<unknown> | Iterable<unknown>;
  closest(selector: string): unknown;
  getAttribute(name: string): string | null;
}

export function parseSemanticActionPath(path: string): SemanticActionPathParseOutcome {
  const [rawPath, rawQuery = ""] = path.trim().split("?", 2);

  if (!rawPath.startsWith("/")) {
    return withSemanticParseUnwrapError(
      Result.err({
        code: "invalid_path",
        message: `Action path "${path}" must start with "/".`,
      }),
    );
  }

  const normalizedPath = normalizeSemanticPath(rawPath);
  return withSemanticParseUnwrapError(
    Result.ok({
      path: normalizedPath,
      segments: normalizedPath.split("/").filter(Boolean).map(decodeURIComponent),
      query: parseSemanticQuery(rawQuery),
    }),
  );
}

export function matchSemanticActionPath(
  path: string,
  pattern: string,
): SemanticActionPathMatchOutcome {
  const parsedPath = parseSemanticActionPath(path);
  const parsedPattern = parseSemanticActionPath(pattern);

  if (Result.isError(parsedPath) || Result.isError(parsedPattern)) {
    return semanticPathNotMatched(path, pattern);
  }

  const pathSegments = parsedPath.value.segments;
  const patternSegments = parsedPattern.value.segments;

  if (pathSegments.length !== patternSegments.length) {
    return semanticPathNotMatched(path, pattern);
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index = index + 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];
    const param = patternSegment.match(/^\{([^{}]+)\}$/);

    if (param) {
      params[param[1]] = pathSegment;
      continue;
    }

    if (patternSegment !== pathSegment) {
      return semanticPathNotMatched(path, pattern);
    }
  }

  return withSemanticMatchUnwrapError(
    Result.ok({
      path: parsedPath.value.path,
      pattern: parsedPattern.value.path,
      params,
    }),
  );
}

export function materializeHtmlSurface<TControl>(
  options: HtmlSurfaceMaterializeOptions<TControl>,
): HtmlSurfaceMaterializeOutcome {
  const unknownControl = findUnknownControlRef(options.html, options.controls);

  if (unknownControl) {
    return withUnwrapError(
      Result.err({
        code: "unknown_control",
        message: `HTML references unknown gr-control "${unknownControl}".`,
      }),
    );
  }

  return withUnwrapError(
    Result.ok({
      html: options.html.replace(
        /\sgr-control=("([^"]*)"|'([^']*)')/g,
        (
          _match,
          _quoted: string,
          doubleQuoted: string | undefined,
          singleQuoted: string | undefined,
        ) => {
          const controlRef = doubleQuoted ?? singleQuoted ?? "";
          const actionId = options.mintAction(options.controls[controlRef]);
          return ` gr-href="${escapeHtmlAttribute(actionId)}"`;
        },
      ),
    }),
  );
}

export function hydrateHtmlSurface(
  root: EventTarget,
  options: HtmlSurfaceHydrationOptions,
): HtmlSurfaceHydration {
  const onClick = (event: Event) => {
    const control = closestElement(event.target, "[gr-href]");
    if (!control || tagName(control) === "form") return;

    const actionId = readActionId(control);
    if (!actionId) return;

    preventDefault(event);
    submit(options, actionId, { type: "click" });
  };

  const onSubmit = (event: Event) => {
    const form = closestElement(event.target, "form[gr-href]");
    if (!form) return;

    const actionId = readActionId(form);
    if (!actionId) return;

    preventDefault(event);
    submit(options, actionId, {
      type: "submit",
      values: readFormValues(form),
    });
  };

  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);

  return {
    dispose() {
      root.removeEventListener("click", onClick);
      root.removeEventListener("submit", onSubmit);
    },
  };
}

function withUnwrapError(
  result: BetterResult<
    HtmlSurfaceMaterializeResult,
    HtmlSurfaceMaterializeError
  >,
): HtmlSurfaceMaterializeOutcome {
  return Object.assign(result, {
    unwrapError() {
      if (Result.isError(result)) return result.error;
      throw new Error("Cannot unwrap error from an ok result.");
    },
  });
}

function withSemanticParseUnwrapError(
  result: BetterResult<SemanticActionPath, SemanticActionPathParseError>,
): SemanticActionPathParseOutcome {
  return Object.assign(result, {
    unwrapError() {
      if (Result.isError(result)) return result.error;
      throw new Error("Cannot unwrap error from an ok result.");
    },
  });
}

function withSemanticMatchUnwrapError(
  result: BetterResult<SemanticActionPathMatch, SemanticActionPathMatchError>,
): SemanticActionPathMatchOutcome {
  return Object.assign(result, {
    unwrapError() {
      if (Result.isError(result)) return result.error;
      throw new Error("Cannot unwrap error from an ok result.");
    },
  });
}

function semanticPathNotMatched(path: string, pattern: string): SemanticActionPathMatchOutcome {
  return withSemanticMatchUnwrapError(
    Result.err({
      code: "not_matched",
      message: `Action path "${path}" does not match pattern "${pattern}".`,
    }),
  );
}

function normalizeSemanticPath(path: string): string {
  const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return withoutTrailingSlash || "/";
}

function parseSemanticQuery(query: string): SemanticActionQuery {
  const values: SemanticActionQuery = {};
  if (!query) return values;

  for (const [key, value] of new URLSearchParams(query)) {
    const current = values[key];

    if (current === undefined) {
      values[key] = value;
      continue;
    }

    values[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }

  return values;
}

function findUnknownControlRef<TControl>(
  html: string,
  controls: Record<string, TControl>,
): string | undefined {
  for (const match of html.matchAll(/\sgr-control=("([^"]*)"|'([^']*)')/g)) {
    const controlRef = match[2] ?? match[3] ?? "";
    if (!(controlRef in controls)) return controlRef;
  }

  return undefined;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function submit(
  options: HtmlSurfaceHydrationOptions,
  actionId: string,
  submission: HtmlSurfaceActionSubmission,
): void {
  try {
    Promise.resolve(options.submitAction(actionId, submission)).then(
      (result) => {
        if (result && Result.isError(result)) {
          options.onError?.(result.error);
        }
      },
      (error: unknown) => {
        options.onError?.(error);
      },
    );
  } catch (error) {
    options.onError?.(error);
  }
}

function closestElement(
  target: EventTarget | null,
  selector: string,
): ElementLike | null {
  if (!isElementLike(target)) return null;

  const closest = target.closest(selector);
  return isElementLike(closest) ? closest : null;
}

function isElementLike(value: unknown): value is ElementLike {
  return (
    !!value &&
    typeof value === "object" &&
    "closest" in value &&
    typeof value.closest === "function" &&
    "getAttribute" in value &&
    typeof value.getAttribute === "function"
  );
}

function tagName(element: ElementLike): string {
  return element.tagName?.toLowerCase() ?? "";
}

function readActionId(element: ElementLike): string | undefined {
  const actionId = element.getAttribute("gr-href")?.trim();
  return actionId ? actionId : undefined;
}

function preventDefault(event: Event): void {
  event.preventDefault();
}

function readFormValues(form: ElementLike): HtmlSurfaceFormValues {
  const values: HtmlSurfaceFormValues = {};

  for (const element of toArray(form.elements)) {
    if (!isFormControlLike(element)) continue;
    if (isDisabled(element)) continue;

    const name = controlName(element);
    if (!name) continue;

    const type = controlType(element);
    if ((type === "checkbox" || type === "radio") && !isChecked(element))
      continue;
    if (type === "file") continue;

    for (const value of controlValues(element)) {
      appendValue(values, name, value);
    }
  }

  return values;
}

interface FormControlLike {
  readonly selectedOptions?: ArrayLike<unknown> | Iterable<unknown>;
  getAttribute(name: string): string | null;
}

function isFormControlLike(value: unknown): value is FormControlLike {
  return (
    !!value &&
    typeof value === "object" &&
    "getAttribute" in value &&
    typeof value.getAttribute === "function"
  );
}

function toArray(
  value: ArrayLike<unknown> | Iterable<unknown> | undefined,
): unknown[] {
  if (!value) return [];
  return Symbol.iterator in Object(value)
    ? Array.from(value as Iterable<unknown>)
    : Array.from(value as ArrayLike<unknown>);
}

function isDisabled(control: FormControlLike): boolean {
  return (
    booleanProperty(control, "disabled") ||
    control.getAttribute("disabled") !== null
  );
}

function controlName(control: FormControlLike): string {
  return stringProperty(control, "name") ?? control.getAttribute("name") ?? "";
}

function controlType(control: FormControlLike): string {
  return (
    stringProperty(control, "type") ??
    control.getAttribute("type") ??
    ""
  ).toLowerCase();
}

function isChecked(control: FormControlLike): boolean {
  return (
    booleanProperty(control, "checked") ||
    control.getAttribute("checked") !== null
  );
}

function controlValues(control: FormControlLike): string[] {
  if (isMultipleSelect(control)) {
    return toArray(control.selectedOptions)
      .map(
        (option) =>
          stringProperty(option, "value") ?? getAttribute(option, "value"),
      )
      .filter((value): value is string => value !== undefined);
  }

  return [
    stringProperty(control, "value") ?? control.getAttribute("value") ?? "",
  ];
}

function isMultipleSelect(control: FormControlLike): boolean {
  return (
    booleanProperty(control, "multiple") ||
    control.getAttribute("multiple") !== null
  );
}

function appendValue(
  values: HtmlSurfaceFormValues,
  name: string,
  value: string,
): void {
  const current = values[name];

  if (current === undefined) {
    values[name] = value;
    return;
  }

  values[name] = Array.isArray(current)
    ? [...current, value]
    : [current, value];
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  const property = (value as Record<string, unknown>)[key];
  if (typeof property === "string") return property;
  if (typeof property === "number" || typeof property === "boolean")
    return String(property);
  return undefined;
}

function booleanProperty(value: unknown, key: string): boolean {
  if (!value || typeof value !== "object" || !(key in value)) return false;
  return (value as Record<string, unknown>)[key] === true;
}

function getAttribute(value: unknown, key: string): string | undefined {
  if (!isFormControlLike(value)) return undefined;
  return value.getAttribute(key) ?? undefined;
}
