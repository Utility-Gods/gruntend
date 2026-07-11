import {
  getModel,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type TextContent,
} from "@earendil-works/pi-ai";
import type { Tool } from "./tool.ts";

export { getModel };
export type { Api, AssistantMessage, Context, Model, SimpleStreamOptions };

export interface GeneratedCodePlan {
  readonly summary: string;
  readonly input: Record<string, unknown>;
  readonly code: string;
}

export interface CodePlanToolManifest {
  readonly name: string;
  readonly description: string;
  readonly parameters?: unknown;
  readonly returns?: unknown;
}

export type CodePlanGenerationComplete<TApi extends Api = Api> = (
  model: Model<TApi>,
  context: Context,
  options?: SimpleStreamOptions,
) => Promise<AssistantMessage>;

export interface CodePlanGenerationUiOptions {
  readonly kind: "tagged-html";
}

export interface CodePlanPromptRequest {
  readonly tools: readonly Tool[];
  readonly task: string;
  readonly input?: unknown;
  readonly instructions?: string;
  readonly ui?: CodePlanGenerationUiOptions;
}

export interface CodePlanPrompt {
  readonly system: string;
  readonly user: string;
}

export interface CodePlanGenerationRequest<TApi extends Api = Api>
  extends CodePlanPromptRequest {
  readonly model: Model<TApi>;
  readonly options?: SimpleStreamOptions;
  readonly complete?: CodePlanGenerationComplete<TApi>;
}

export interface CodePlanGenerationResponse {
  readonly plan: GeneratedCodePlan;
  readonly text: string;
  readonly message: AssistantMessage;
}

export class GeneratedCodePlanParseError extends Error {
  readonly responseText: string;
  readonly extractedText: string;

  constructor(input: {
    readonly cause: unknown;
    readonly responseText: string;
    readonly extractedText: string;
  }) {
    const detail =
      input.cause instanceof Error ? input.cause.message : String(input.cause);
    super(`Could not parse generated code plan JSON: ${detail}`, {
      cause: input.cause,
    });
    this.name = "GeneratedCodePlanParseError";
    this.responseText = input.responseText;
    this.extractedText = input.extractedText;
  }
}

export function createCodePlanManifest(
  tools: readonly Tool[],
): readonly CodePlanToolManifest[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    ...(tool.parameters === undefined ? {} : { parameters: tool.parameters }),
    ...(tool.returns === undefined ? {} : { returns: tool.returns }),
  }));
}

export function createCodePlanPrompt(
  request: CodePlanPromptRequest,
): CodePlanPrompt {
  return {
    system: codePlanSystemPrompt(request.ui),
    user: JSON.stringify(
      {
        task: request.task,
        instructions: request.instructions ?? undefined,
        input: request.input ?? {},
        tools: createCodePlanManifest(request.tools),
      },
      null,
      2,
    ),
  };
}

export function parseGeneratedCodePlan(text: string): GeneratedCodePlan {
  const extractedText = extractJsonObject(text);

  try {
    return validateGeneratedCodePlan(JSON.parse(extractedText));
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    throw new GeneratedCodePlanParseError({
      cause,
      responseText: text,
      extractedText,
    });
  }
}

export function validateGeneratedCodePlan(value: unknown): GeneratedCodePlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Generated code plan must be a JSON object.");
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.summary !== "string" ||
    record.summary.trim().length === 0
  ) {
    throw new Error(
      'Generated code plan must include a non-empty "summary" string.',
    );
  }

  if (
    !record.input ||
    typeof record.input !== "object" ||
    Array.isArray(record.input)
  ) {
    throw new Error('Generated code plan must include an "input" object.');
  }

  if (typeof record.code !== "string" || record.code.trim().length === 0) {
    throw new Error(
      'Generated code plan must include a non-empty "code" string.',
    );
  }

  return {
    summary: record.summary,
    input: normalizeGeneratedInput(record.input as Record<string, unknown>),
    code: record.code,
  };
}

export async function generateCodePlan<TApi extends Api>(
  request: CodePlanGenerationRequest<TApi>,
): Promise<CodePlanGenerationResponse> {
  const complete = request.complete ?? defaultComplete;
  const message = await complete(
    request.model,
    createPiAiContext(request),
    request.options,
  );

  if (message.stopReason === "error" || message.stopReason === "aborted") {
    throw new Error(
      message.errorMessage ?? `Code plan generation ${message.stopReason}.`,
    );
  }

  const text = assistantText(message);
  const plan = parseGeneratedCodePlan(text);

  return {
    plan,
    text,
    message,
  };
}

function normalizeGeneratedInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(input);
  if (keys.length === 1 && isRecord(input.plain)) {
    return input.plain;
  }

  return input;
}

async function defaultComplete<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: SimpleStreamOptions,
): Promise<AssistantMessage> {
  const { completeSimple } = await import("@earendil-works/pi-ai");
  return completeSimple(model, context, options);
}

function createPiAiContext<TApi extends Api>(
  request: CodePlanGenerationRequest<TApi>,
): Context {
  const prompt = createCodePlanPrompt(request);

  return {
    systemPrompt: prompt.system,
    messages: [
      {
        role: "user",
        content: prompt.user,
        timestamp: Date.now(),
      },
    ],
  };
}

function codePlanSystemPrompt(ui?: CodePlanGenerationUiOptions): string {
  const uiInstructions =
    ui?.kind === "tagged-html" ? taggedHtmlInstructions() : "";

  return `You generate Gruntend JavaScript code plans from user tasks and tool manifests.

Return JSON only. Do not include markdown, prose, or code fences.

The JSON shape must be exactly:
{
  "summary": "short human-readable summary",
  "input": { "key": "values the code plan reads directly as input.key" },
  "code": "JavaScript async function body as a string"
}

The code is executed as an async function body by Gruntend. It can only access these globals:
- input
- tools
- Promise
- console${ui?.kind === "tagged-html" ? "\n- html" : ""}

Rules:
- Do not use imports, require, fetch, window, document, localStorage, process, external APIs, or TypeScript syntax.
- Do not invent tools. Only call tools from the tool manifest.
- Prefer the exact nested tool namespace implied by dot-separated names, e.g. menu.items.list becomes tools.menu.items.list(...).
- The returned JSON input object is passed directly to the runtime as the input global.
- Do not wrap input values under plain, data, args, parameters, or any other container.
- Put reusable constants directly in input and reference them from code, e.g. "input": { "menuName": "Dinner" } and input.menuName.
- Use tools to read only the app data needed to satisfy the user request. Do not enrich results with unrelated data unless the user asks for it.
- Use tools to read current app data before mutating when the task depends on existing state.
- Use await for dependent calls and Promise.all([...]) for independent calls.
- If the task cannot be completed with the available tools, do not invent capabilities. Return a clear explanation object in data mode or an html explanation in tagged-html UI mode.${uiInstructions}`;
}

function taggedHtmlInstructions(): string {
  return `

Tagged HTML UI mode:
- The runtime provides one UI primitive: html tagged templates.
- The final top-level return value MUST be an html template or a render function. The app will reject plain objects and arrays.
- Return UI as either return html\`...\`; or return function render() { return html\`...\`; }.
- Use return function render() when the UI needs local component state.
- Keep local component state in normal JavaScript closures with var and function declarations.
- Bind events with function interpolation, e.g. onclick=\${handler}, onsubmit=\${handler}, oninput=\${handler}, or onchange=\${handler}.
- Do not use string event handlers such as onclick="handler()".
- Do not use style attributes; the host compiler strips inline styles.
- Use semantic class names instead of inline styles: surface-card, surface-text, surface-list, surface-actions, surface-item, surface-action, is-selected, surface-table, surface-muted, surface-badge.
- Do not string-build HTML with concatenation, arrays of strings, or template strings that are not tagged with html.
- Do not return plain data objects such as { menus: [...] }, { items: [...] }, { ok: false }, { html: "..." }, plain explanation objects, or separate UI JSON.
- For read/list/summarize requests, compute the data with tools and then render that data as html UI.
- If a requested operation is impossible with the available tools, still return html UI that explains the missing capability and shows the relevant data/capabilities that are available.
- Do not use a JSON UI DSL, component catalog, JSX, Svelte syntax, or TypeScript syntax.
- For text and attributes, interpolate values directly in html templates so the host compiler can escape them.
- Interpolations may only fill text, attribute values, or event handler values. They must not add/remove attribute names or tag syntax.
- Do not write dynamic attributes like <option \${condition ? "selected" : ""}>. For boolean attributes, write selected=\${condition}, checked=\${condition}, or disabled=\${condition}.
- For lists, use Array.prototype.map and return nested html templates.
- Expose relevant capabilities for rendered entities wherever possible, even in read-oriented views.
- Every entity card or row should include a surface-actions area only when matching tools exist and the action can be called with data already available on that entity.
- Omit empty surface-actions containers.
- For example, if tools.menu.item.duplicate exists, menu item rows should include a Duplicate button that calls tools.menu.item.duplicate from an onclick handler.
- For example, if tools.menu.item.delete exists, menu item rows should include a clearly labeled Delete button that calls tools.menu.item.delete from an onclick handler and updates local UI state.
- Keep capabilities explicit and safe: label destructive actions clearly and use app tools inside event handlers for effects.
- Mutation tools are tools that create, update, delete, duplicate, copy, move, assign, remove, change prices, change tags, or otherwise alter app state.
- In tagged-html UI mode, never call mutation tools during initial code execution. Initial execution may read data and compute a preview only.
- If the user asks for a mutation, return a confirmation UI instead of doing it immediately.
- The confirmation UI must show what will change, including before and after values when available.
- Put mutation tool calls behind a clearly labeled Confirm button or equivalent user action.
- Preserve the preview's before and after values across confirmation. Do not recompute the preview from updated data in a way that loses the original before values.
- After confirmation, update local UI state from handler results and show what changed.

Capability example:
var items = input.items;
async function duplicateItem(item) {
  var duplicated = await tools.menu.item.duplicate({ menuId: item.menuId, itemId: item.itemId });
  items = items.concat([duplicated.item]);
}
async function deleteItem(item) {
  await tools.menu.item.delete({ menuId: item.menuId, itemId: item.itemId });
  items = items.filter(function (candidate) { return candidate.itemId !== item.itemId; });
}
return function render() {
  return html\`<section class="surface-card"><div class="surface-list">\${items.map(function (item) {
    return html\`<article class="surface-item"><span><strong>\${item.name}</strong><span>\${item.price}</span></span><div class="surface-actions"><button type="button" onclick=\${function () { return duplicateItem(item); }}>Confirm duplicate</button><button type="button" onclick=\${function () { return deleteItem(item); }}>Confirm delete</button></div></article>\`;
  })}</div></section>\`;
};

Read-only list example:
var menusResult = await tools.menus.list({});
var menus = menusResult.menus || [];
return html\`<section class="surface-card"><h2 class="surface-title">Menus</h2><div class="surface-list">\${menus.map(function (menu) {
  return html\`<article class="surface-item"><span><strong>\${menu.name}</strong><span>\${menu.description}</span></span></article>\`;
})}</div></section>\`;

Confirmation-first mutation example:
var itemsResult = await tools.menu.items.list({ menuId: input.menuId });
var previewItems = (itemsResult.items || []).map(function (item) {
  return {
    item: item,
    beforePrice: item.price,
    afterPrice: Math.round(item.price * 1.25 * 100) / 100,
    updated: null
  };
});
var confirmed = false;
var status = "ready";
async function confirmPriceIncrease() {
  status = "running";
  var updated = await Promise.all(previewItems.map(function (entry) {
    return tools.menu.item.update({ menuId: entry.item.menuId, itemId: entry.item.itemId, price: entry.afterPrice });
  }));
  previewItems = previewItems.map(function (entry, index) {
    return { item: entry.item, beforePrice: entry.beforePrice, afterPrice: entry.afterPrice, updated: updated[index].item };
  });
  confirmed = true;
  status = "done";
}
return function render() {
  return html\`<section class="surface-card"><h2 class="surface-title">Confirm price changes</h2><div class="surface-list">\${previewItems.map(function (entry) {
    return html\`<article class="surface-item"><span><strong>\${entry.item.name}</strong><span>Before: \${entry.beforePrice} · After: \${entry.afterPrice}</span></span></article>\`;
  })}</div>\${confirmed ? html\`<p class="surface-text">Price changes applied.</p>\` : html\`<div class="surface-actions"><button type="button" onclick=\${confirmPriceIncrease}>Confirm update prices</button></div>\`}</section>\`;
};

Minimal stateful example:
var count = 0;
function increment() {
  count = count + 1;
}
return function render() {
  return html\`<section class="surface-card"><p class="surface-text">Count: \${count}</p><button type="button" class="surface-action" onclick=\${increment}>Increment</button></section>\`;
};`;
}

function assistantText(message: AssistantMessage): string {
  return message.content
    .filter((content): content is TextContent => content.type === "text")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function extractJsonObject(text: string): string {
  const trimmed = stripMarkdownFence(text.trim());

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error(
        "Generated code plan response did not contain a JSON object.",
      );
    }

    return trimmed.slice(start, end + 1);
  }
}

function stripMarkdownFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
