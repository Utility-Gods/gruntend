import { Result, type Result as BetterResult } from "better-result";
import { ElementType, parseDocument } from "htmlparser2";
import * as v from "valibot";

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
}

export type UiCallable = ((...args: readonly unknown[]) => unknown) | UiInterpretedFunction;
export type UiEventHandler = UiCallable;
export type UiRenderFunction = UiCallable;

export interface UiTemplateCompileResult {
  readonly html: string;
  readonly handlers: Record<string, UiEventHandler>;
}

export interface UiTemplateCompileError {
  readonly code: "invalid_render" | "unsafe_attribute" | "unsafe_interpolation" | "unsafe_tag";
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
const unsafeTags = new Set(["script", "iframe", "object", "embed", "link", "style", "meta"]);
const eventAttributes = new Set(["onclick", "onsubmit", "oninput", "onchange"]);
const allowedAttributes = new Set([
  "class",
  "id",
  "role",
  "name",
  "value",
  "type",
  "checked",
  "disabled",
  "selected",
  "placeholder",
  "gr-href",
]);

export function createUiTemplateTag(): UiTemplateTag {
  return (strings: TemplateStringsArray, ...values: readonly unknown[]): UiTemplate => ({
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
  });
}

export function compileUiTemplate(template: UiTemplate): UiTemplateCompileOutcome {
  const context: UiTemplateCompileContext = {
    handlers: {},
    nextHandlerId: 0,
  };
  const html = compileTemplateHtml(template, context);

  if (Result.isError(html)) return outcomeErr(html.error);

  return sanitizeHtml(html.value, context.handlers);
}

interface UiTemplateCompileContext {
  readonly handlers: Record<string, UiEventHandler>;
  nextHandlerId: number;
}

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
    if (interpolation === "structure") {
      return Result.err({
        code: "unsafe_interpolation",
        message: "Interpolations cannot change tag or attribute structure.",
      });
    }

    if (interpolation?.kind === "event") {
      if (!isUiEventHandler(value)) {
        return Result.err({
          code: "unsafe_interpolation",
          message: "Event interpolations must be functions.",
        });
      }

      const handlerId = `h${context.nextHandlerId}`;
      context.nextHandlerId = context.nextHandlerId + 1;
      context.handlers[handlerId] = value;
      html = html.replace(new RegExp(`${interpolation.attribute}\\s*=\\s*$`, "i"), `data-gr-${interpolation.event}=`);
      html += `"${handlerId}"`;
      continue;
    }

    if (interpolation?.kind === "attribute") {
      html += `"${escapeHtml(String(value))}"`;
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
  if (value === null || value === undefined || value === false) return Result.ok("");

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
): "text" | "structure" | { kind: "event"; attribute: string; event: string } | { kind: "attribute" } {
  const lastOpen = before.lastIndexOf("<");
  const lastClose = before.lastIndexOf(">");
  const inTag = lastOpen > lastClose;

  if (!inTag) return "text";

  const attr = before.match(/([:@A-Za-z0-9_-]+)\s*=\s*$/)?.[1];
  if (!attr) return "structure";

  const next = after[0];
  if (next && next !== ">" && next !== "/" && !/\s/.test(next)) {
    return "structure";
  }

  const lower = attr.toLowerCase();
  if (eventAttributes.has(lower)) {
    return { kind: "event", attribute: attr, event: lower.slice(2) };
  }

  return { kind: "attribute" };
}

function sanitizeHtml(
  html: string,
  handlers: Record<string, UiEventHandler>,
): UiTemplateCompileOutcome {
  const document = parseDocument(html, {
    lowerCaseAttributeNames: true,
    lowerCaseTags: true,
    recognizeSelfClosing: true,
  });

  const serialized = serializeNodes(document.children as readonly DomNode[]);
  if (Result.isError(serialized)) return outcomeErr(serialized.error);

  return outcomeOk({ html: serialized.value, handlers });
}

type DomNode = {
  readonly type?: string;
  readonly name?: string;
  readonly data?: string;
  readonly attribs?: Record<string, string>;
  readonly children?: readonly DomNode[];
};

function serializeNodes(nodes: readonly DomNode[]): BetterResult<string, UiTemplateCompileError> {
  let html = "";

  for (const node of nodes) {
    const serialized = serializeNode(node);
    if (Result.isError(serialized)) return serialized;
    html += serialized.value;
  }

  return Result.ok(html);
}

function serializeNode(node: DomNode): BetterResult<string, UiTemplateCompileError> {
  if (node.type === ElementType.Text) return Result.ok(escapeHtml(node.data ?? ""));
  if (node.type === ElementType.Comment || node.type === ElementType.Directive) return Result.ok("");

  if (node.type !== ElementType.Tag && node.type !== ElementType.Script && node.type !== ElementType.Style) {
    return serializeNodes(node.children ?? []);
  }

  const tag = (node.name ?? "").toLowerCase();
  if (unsafeTags.has(tag) || node.type === ElementType.Script || node.type === ElementType.Style) {
    return Result.err({
      code: "unsafe_tag",
      message: `Tag "${tag}" is not allowed.`,
    });
  }

  const attrs = sanitizeAttributes(node.attribs ?? {});
  if (Result.isError(attrs)) return attrs;

  const children = serializeNodes(node.children ?? []);
  if (Result.isError(children)) return children;

  return Result.ok(`<${tag}${attrs.value}>${children.value}</${tag}>`);
}

function sanitizeAttributes(attrs: Record<string, string>): BetterResult<string, UiTemplateCompileError> {
  const kept: string[] = [];

  for (const [rawName, rawValue] of Object.entries(attrs)) {
    const name = rawName.toLowerCase();

    if (name.startsWith("on")) {
      return Result.err({
        code: "unsafe_attribute",
        message: `Static event attribute "${name}" is not allowed.`,
      });
    }

    if (name.startsWith("aria-") || name.startsWith("data-gr-") || allowedAttributes.has(name)) {
      kept.push(`${name}="${escapeHtml(rawValue)}"`);
    }
  }

  return Result.ok(kept.length ? ` ${kept.join(" ")}` : "");
}

function isUiEventHandler(value: unknown): value is UiEventHandler {
  return typeof value === "function" || isUiInterpretedFunction(value);
}

function isUiRenderFunction(value: unknown): value is UiRenderFunction {
  return isUiEventHandler(value);
}

function isUiInterpretedFunction(value: unknown): value is UiInterpretedFunction {
  return !!value && typeof value === "object" && "call" in value && typeof (value as { call?: unknown }).call === "function";
}

function isUiTemplate(value: unknown): value is UiTemplate {
  return v.safeParse(uiTemplateSchema, value).success;
}

function callUiFunction(handler: UiRenderFunction, ...args: readonly unknown[]): unknown {
  if (typeof handler === "function") return handler(...args);
  return handler.call(undefined, ...args);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
