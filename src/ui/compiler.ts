import { Result, type Result as BetterResult } from "better-result";
import * as v from "valibot";
import {
  generatedUiAllowedAttributes,
  generatedUiAllowedTags,
  generatedUiForbiddenAttributes,
  generatedUiRuntimeAttributes,
} from "./policy.ts";

export interface UiTemplate {
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
}

export type UiTemplateTag = (
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
) => UiTemplate;

export interface UiInterpretedFunction {
  call(thisArg: unknown, ...args: readonly unknown[]): unknown;
  destroy?(): void;
}

export type UiCallable =
  | ((...args: readonly unknown[]) => unknown)
  | UiInterpretedFunction;
export type UiEventHandler = UiCallable;
export type UiRenderFunction = UiCallable;

export interface UiTemplateCompileResult {
  readonly html: string;
  readonly handlers: Record<string, UiEventHandler>;
}

export interface UiTemplateCompileError {
  readonly code:
    | "invalid_render"
    | "unsafe_attribute"
    | "unsafe_interpolation"
    | "unsafe_tag";
  readonly message: string;
}

export type UiTemplateCompileOutcome = BetterResult<
  UiTemplateCompileResult,
  UiTemplateCompileError
> & {
  unwrapError(): UiTemplateCompileError;
};

export interface UiComponent {
  render(): UiTemplateCompileOutcome;
  dispatch(handlerId: string, ...args: readonly unknown[]): unknown;
  destroy(): void;
}

export interface UiComponentCreateError {
  readonly code: "invalid_component";
  readonly message: string;
}

export type UiComponentCreateOutcome = BetterResult<
  UiComponent,
  UiComponentCreateError
> & {
  unwrapError(): UiComponentCreateError;
};

const uiTemplateSchema = v.object({
  strings: v.array(v.string()),
  values: v.array(v.unknown()),
});
const allowedTags = new Set<string>(generatedUiAllowedTags);
const eventAttributes = new Set(["onclick", "onsubmit", "oninput", "onchange"]);
const booleanAttributes = new Set(["checked", "disabled", "selected"]);
const allowedAttributes = new Set<string>(generatedUiAllowedAttributes);
const svgAttributeNames: Readonly<Record<string, string>> = {
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
  pathlength: "pathLength",
};
const paintAttributes = new Set(["fill", "stroke"]);
const rejectedAttributes = new Set<string>(generatedUiForbiddenAttributes);
const runtimeAttributes = new Set<string>(generatedUiRuntimeAttributes);
const attributePattern =
  /([:@A-Za-z0-9_-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

export function createUiTemplateTag(): UiTemplateTag {
  return (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): UiTemplate => ({
    strings: Array.from(strings),
    values,
  });
}

export function createUiComponent(value: unknown): UiComponentCreateOutcome {
  const render = isUiTemplate(value)
    ? () => value
    : isUiRenderFunction(value)
      ? value
      : undefined;

  if (!render) {
    return componentErr({
      code: "invalid_component",
      message: "UI code must return an html template or render function.",
    });
  }

  let handlers: Record<string, UiEventHandler> = {};

  return componentOk({
    render() {
      const rendered = callUiFunction(render);

      if (!isUiTemplate(rendered)) {
        return outcomeErr({
          code: "invalid_render",
          message: "Render functions must return an html template.",
        });
      }

      const compiled = compileUiTemplate(rendered);
      if (Result.isOk(compiled)) handlers = compiled.value.handlers;
      return compiled;
    },
    dispatch(handlerId, ...args) {
      const handler = handlers[handlerId];

      if (!handler) {
        throw new Error(`UI handler "${handlerId}" does not exist.`);
      }

      return callUiFunction(handler, ...args);
    },
    destroy() {
      handlers = {};
      if (isUiInterpretedFunction(render)) render.destroy?.();
    },
  });
}

export function compileUiTemplate(
  template: UiTemplate,
): UiTemplateCompileOutcome {
  const context: UiTemplateCompileContext = {
    handlers: {},
    nextHandlerId: 0,
  };
  const html = compileTemplateHtml(template, context);

  if (Result.isError(html)) return outcomeErr(html.error);

  return sanitizeHtml(html.value, context);
}

interface UiTemplateCompileContext {
  readonly handlers: Record<string, UiEventHandler>;
  nextHandlerId: number;
}

type TemplateInterpolationContext =
  | { readonly kind: "text" }
  | { readonly kind: "structure" }
  | {
      readonly kind: "event";
      readonly attribute: string;
      readonly event: string;
      readonly quoted: boolean;
    }
  | {
      readonly kind: "attribute";
      readonly attribute: string;
      readonly quoted: boolean;
    };

function compileTemplateHtml(
  template: UiTemplate,
  context: UiTemplateCompileContext,
): BetterResult<string, UiTemplateCompileError> {
  let html = "";

  for (let index = 0; index < template.values.length; index = index + 1) {
    const before = template.strings[index] ?? "";
    const after = template.strings[index + 1] ?? "";
    const value = template.values[index];

    html += before;

    const interpolation = interpolationContext(html, after);
    if (interpolation.kind === "structure") {
      return Result.err({
        code: "unsafe_interpolation",
        message: "Interpolations cannot change tag or attribute structure.",
      });
    }

    if (interpolation.kind === "event") {
      if (!isUiEventHandler(value)) {
        return Result.err({
          code: "unsafe_interpolation",
          message: "Event interpolations must be functions.",
        });
      }

      const handlerId = `h${context.nextHandlerId}`;
      context.nextHandlerId = context.nextHandlerId + 1;
      context.handlers[handlerId] = value;

      if (interpolation.quoted) {
        html = html.replace(
          new RegExp(
            `${escapeRegExp(interpolation.attribute)}\\s*=\\s*(["'])$`,
            "i",
          ),
          `data-gr-${interpolation.event}=$1`,
        );
        html += handlerId;
      } else {
        html = html.replace(
          new RegExp(`${escapeRegExp(interpolation.attribute)}\\s*=\\s*$`, "i"),
          `data-gr-${interpolation.event}=`,
        );
        html += `"${handlerId}"`;
      }
      continue;
    }

    if (interpolation.kind === "attribute") {
      if (booleanAttributes.has(interpolation.attribute.toLowerCase())) {
        if (value === false || value === null || value === undefined) {
          html = html.replace(
            new RegExp(
              `\\s*${escapeRegExp(interpolation.attribute)}\\s*=\\s*$`,
              "i",
            ),
            "",
          );
        } else {
          html += `"${escapeHtml(interpolation.attribute.toLowerCase())}"`;
        }
        continue;
      }

      html += interpolation.quoted
        ? escapeHtml(String(value))
        : `"${escapeHtml(String(value))}"`;
      continue;
    }

    const text = compileTextInterpolation(value, context);
    if (Result.isError(text)) return text;
    html += text.value;
  }

  html += template.strings[template.strings.length - 1] ?? "";

  return Result.ok(html);
}

function compileTextInterpolation(
  value: unknown,
  context: UiTemplateCompileContext,
): BetterResult<string, UiTemplateCompileError> {
  if (value === null || value === undefined || value === false)
    return Result.ok("");

  if (isUiTemplate(value)) {
    return compileTemplateHtml(value, context);
  }

  if (Array.isArray(value)) {
    let html = "";

    for (const item of value) {
      const rendered = compileTextInterpolation(item, context);
      if (Result.isError(rendered)) return rendered;
      html += rendered.value;
    }

    return Result.ok(html);
  }

  if (isUiEventHandler(value)) {
    return Result.err({
      code: "unsafe_interpolation",
      message: "Function interpolations are only allowed in event attributes.",
    });
  }

  return Result.ok(escapeHtml(String(value)));
}

function interpolationContext(
  before: string,
  after: string,
): TemplateInterpolationContext {
  if (!endsInsideTag(before)) return { kind: "text" };

  const quotedAttr = before.match(/([:@A-Za-z0-9_-]+)\s*=\s*(["'])([^"']*)$/);
  if (quotedAttr) {
    const attr = quotedAttr[1];
    const quote = quotedAttr[2];
    const prefix = quotedAttr[3];
    const next = after[1];
    const fillsWholeAttribute =
      prefix.length === 0 &&
      after[0] === quote &&
      (!next || next === ">" || next === "/" || /\s/.test(next));
    const lower = attr.toLowerCase();

    if (booleanAttributes.has(lower)) return { kind: "structure" };

    if (eventAttributes.has(lower)) {
      if (!fillsWholeAttribute) return { kind: "structure" };
      return {
        kind: "event",
        attribute: attr,
        event: lower.slice(2),
        quoted: true,
      };
    }

    return { kind: "attribute", attribute: attr, quoted: true };
  }

  const attr = before.match(/([:@A-Za-z0-9_-]+)\s*=\s*$/)?.[1];
  if (!attr) return { kind: "structure" };

  const next = after[0];
  if (next && next !== ">" && next !== "/" && !/\s/.test(next)) {
    return { kind: "structure" };
  }

  const lower = attr.toLowerCase();
  if (eventAttributes.has(lower)) {
    return {
      kind: "event",
      attribute: attr,
      event: lower.slice(2),
      quoted: false,
    };
  }

  return { kind: "attribute", attribute: attr, quoted: false };
}

function endsInsideTag(value: string): boolean {
  let inTag = false;
  let quote = "";

  for (const character of value) {
    if (!inTag) {
      if (character === "<") inTag = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      inTag = false;
    }
  }

  return inTag;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeHtml(
  html: string,
  context: UiTemplateCompileContext,
): UiTemplateCompileOutcome {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const consumedRuntimeValues = new Set<string>();
  let sanitized = "";
  let index = 0;

  while (index < withoutComments.length) {
    const tagStart = withoutComments.indexOf("<", index);
    if (tagStart === -1) {
      sanitized += withoutComments.slice(index);
      break;
    }

    sanitized += withoutComments.slice(index, tagStart);
    const parsed = readTag(withoutComments, tagStart);
    if (Result.isError(parsed)) return outcomeErr(parsed.error);

    const tag = parsed.value.name.toLowerCase();
    if (!allowedTags.has(tag)) {
      return outcomeErr({
        code: "unsafe_tag",
        message: `Tag "${tag}" is not allowed.`,
      });
    }

    if (parsed.value.closing) {
      sanitized += `</${tag}>`;
    } else {
      const attrs = sanitizeAttributeText(
        parsed.value.attributes,
        context,
        consumedRuntimeValues,
      );
      if (Result.isError(attrs)) return outcomeErr(attrs.error);
      sanitized += `<${tag}${attrs.value}`;
      if (parsed.value.selfClosing) {
        sanitized += " />";
      } else {
        sanitized += ">";
      }
    }

    index = parsed.value.end;
  }

  return outcomeOk({
    html: sanitized,
    handlers: context.handlers,
  });
}

interface ParsedTag {
  readonly name: string;
  readonly attributes: string;
  readonly closing: boolean;
  readonly selfClosing: boolean;
  readonly end: number;
}

function readTag(
  html: string,
  start: number,
): BetterResult<ParsedTag, UiTemplateCompileError> {
  let quote = "";
  let end = start + 1;

  for (; end < html.length; end = end + 1) {
    const character = html[end];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") break;
  }

  if (end >= html.length || quote) {
    return Result.err({
      code: "unsafe_tag",
      message: "Malformed generated markup is not allowed.",
    });
  }

  let body = html.slice(start + 1, end).trim();
  const closing = body.startsWith("/");
  if (closing) body = body.slice(1).trim();
  const selfClosing = !closing && body.endsWith("/");
  if (selfClosing) body = body.slice(0, -1).trimEnd();

  const name = body.match(/^[A-Za-z][A-Za-z0-9-]*/)?.[0];
  if (!name) {
    return Result.err({
      code: "unsafe_tag",
      message: "Malformed generated markup is not allowed.",
    });
  }

  const attributes = body.slice(name.length);
  if (closing && attributes.trim()) {
    return Result.err({
      code: "unsafe_tag",
      message: "Closing tags cannot contain attributes.",
    });
  }

  return Result.ok({
    name,
    attributes,
    closing,
    selfClosing,
    end: end + 1,
  });
}

function sanitizeAttributeText(
  attributeText: string,
  context: UiTemplateCompileContext,
  consumedRuntimeValues: Set<string>,
): BetterResult<string, UiTemplateCompileError> {
  const kept: string[] = [];
  attributePattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(attributeText))) {
    const rawName = match[1];
    const rawValue = match[2] ?? "";
    const name = rawName.toLowerCase();
    const value = decodeBasicEntities(unquoteAttribute(rawValue));

    if (name.startsWith("on")) {
      return Result.err({
        code: "unsafe_attribute",
        message: `Static event attribute "${name}" is not allowed.`,
      });
    }

    if (rawName.includes(":") || rejectedAttributes.has(name)) {
      return Result.err({
        code: "unsafe_attribute",
        message: `Attribute "${name}" is not allowed.`,
      });
    }

    if (
      name.startsWith("data-gr-") &&
      !isKnownRuntimeAttribute(name, value, context, consumedRuntimeValues)
    ) {
      return Result.err({
        code: "unsafe_attribute",
        message: `Generated handler attribute "${name}" references an unknown handler.`,
      });
    }

    if (
      name.startsWith("aria-") ||
      name.startsWith("data-gr-") ||
      allowedAttributes.has(name)
    ) {
      if (name === "href" && !isSafeHref(value)) {
        return Result.err({
          code: "unsafe_attribute",
          message: `Unsafe href "${value}" is not allowed.`,
        });
      }

      if (paintAttributes.has(name) && !isSafePaint(value)) {
        return Result.err({
          code: "unsafe_attribute",
          message: `Unsafe SVG paint value "${value}" is not allowed.`,
        });
      }

      const outputName = svgAttributeNames[name] ?? name;
      kept.push(`${outputName}="${escapeAttributeValue(value)}"`);
    }
  }

  return Result.ok(kept.length ? ` ${kept.join(" ")}` : "");
}

function unquoteAttribute(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isSafeHref(value: string): boolean {
  if (value !== value.trim() || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  return (
    value.startsWith("#") || (value.startsWith("/") && !value.startsWith("//"))
  );
}

function isSafePaint(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || /[\\&\u0000-\u001f\u007f]/.test(normalized)) {
    return false;
  }

  if (/^url\(#[A-Za-z][\w:.-]*\)$/i.test(normalized)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(normalized)) return true;
  if (/^(?:none|currentcolor|transparent|inherit)$/i.test(normalized)) {
    return true;
  }
  if (/^[a-z]+$/i.test(normalized)) return true;
  return /^(?:rgb|rgba|hsl|hsla)\([\d.,%+\-/\s]+\)$/i.test(normalized);
}

function isKnownRuntimeAttribute(
  name: string,
  value: string,
  context: UiTemplateCompileContext,
  consumedRuntimeValues: Set<string>,
): boolean {
  if (!runtimeAttributes.has(name)) return false;

  const key = `handler:${value}`;
  if (consumedRuntimeValues.has(key)) return false;

  const known = !!context.handlers[value];
  if (known) consumedRuntimeValues.add(key);
  return known;
}

function decodeBasicEntities(value: string): string {
  const entities: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  return value.replace(
    /&(amp|apos|gt|lt|quot);/g,
    (_, name: string) => entities[name] ?? "",
  );
}

function escapeAttributeValue(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isUiEventHandler(value: unknown): value is UiEventHandler {
  return typeof value === "function" || isUiInterpretedFunction(value);
}

function isUiRenderFunction(value: unknown): value is UiRenderFunction {
  return isUiEventHandler(value);
}

function isUiInterpretedFunction(
  value: unknown,
): value is UiInterpretedFunction {
  return (
    !!value &&
    typeof value === "object" &&
    "call" in value &&
    typeof (value as { call?: unknown }).call === "function"
  );
}

function isUiTemplate(value: unknown): value is UiTemplate {
  return v.safeParse(uiTemplateSchema, value).success;
}

function callUiFunction(
  handler: UiRenderFunction,
  ...args: readonly unknown[]
): unknown {
  if (typeof handler === "function") return handler(...args);
  return handler.call(undefined, ...args);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function outcomeOk(value: UiTemplateCompileResult): UiTemplateCompileOutcome {
  return Object.assign(Result.ok(value), {
    unwrapError() {
      throw new Error("Cannot unwrap error from an ok result.");
    },
  });
}

function outcomeErr(error: UiTemplateCompileError): UiTemplateCompileOutcome {
  return Object.assign(Result.err(error), {
    unwrapError() {
      return error;
    },
  });
}

function componentOk(value: UiComponent): UiComponentCreateOutcome {
  return Object.assign(Result.ok(value), {
    unwrapError() {
      throw new Error("Cannot unwrap error from an ok result.");
    },
  });
}

function componentErr(error: UiComponentCreateError): UiComponentCreateOutcome {
  return Object.assign(Result.err(error), {
    unwrapError() {
      return error;
    },
  });
}
