import {
  getModel,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type SimpleStreamOptions,
  type TextContent,
} from "@mariozechner/pi-ai";
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

export interface CodePlanGenerationRequest<TApi extends Api = Api> {
  readonly model: Model<TApi>;
  readonly tools: readonly Tool[];
  readonly task: string;
  readonly input?: unknown;
  readonly instructions?: string;
  readonly ui?: CodePlanGenerationUiOptions;
  readonly options?: SimpleStreamOptions;
  readonly complete?: CodePlanGenerationComplete<TApi>;
}

export interface CodePlanGenerationResponse {
  readonly plan: GeneratedCodePlan;
  readonly text: string;
  readonly message: AssistantMessage;
}

export function createCodePlanManifest(tools: readonly Tool[]): readonly CodePlanToolManifest[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    ...(tool.parameters === undefined ? {} : { parameters: tool.parameters }),
    ...(tool.returns === undefined ? {} : { returns: tool.returns }),
  }));
}

export function parseGeneratedCodePlan(text: string): GeneratedCodePlan {
  return validateGeneratedCodePlan(JSON.parse(extractJsonObject(text)));
}

export function validateGeneratedCodePlan(value: unknown): GeneratedCodePlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Generated code plan must be a JSON object.");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.summary !== "string" || record.summary.trim().length === 0) {
    throw new Error('Generated code plan must include a non-empty "summary" string.');
  }

  if (!record.input || typeof record.input !== "object" || Array.isArray(record.input)) {
    throw new Error('Generated code plan must include an "input" object.');
  }

  if (typeof record.code !== "string" || record.code.trim().length === 0) {
    throw new Error('Generated code plan must include a non-empty "code" string.');
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
  const message = await complete(request.model, createPiAiContext(request), request.options);

  if (message.stopReason === "error" || message.stopReason === "aborted") {
    throw new Error(message.errorMessage ?? `Code plan generation ${message.stopReason}.`);
  }

  const text = assistantText(message);
  const plan = parseGeneratedCodePlan(text);

  return {
    plan,
    text,
    message,
  };
}

function normalizeGeneratedInput(input: Record<string, unknown>): Record<string, unknown> {
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
  const { completeSimple } = await import("@mariozechner/pi-ai");
  return completeSimple(model, context, options);
}

function createPiAiContext<TApi extends Api>(request: CodePlanGenerationRequest<TApi>): Context {
  return {
    systemPrompt: codePlanSystemPrompt(request.ui),
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            task: request.task,
            instructions: request.instructions ?? undefined,
            input: request.input ?? {},
            tools: createCodePlanManifest(request.tools),
          },
          null,
          2,
        ),
        timestamp: Date.now(),
      },
    ],
  };
}

function codePlanSystemPrompt(ui?: CodePlanGenerationUiOptions): string {
  const uiInstructions = ui?.kind === "tagged-html" ? taggedHtmlInstructions() : "";

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
- Use the exact nested tool namespace implied by dot-separated names, e.g. menu.items.list becomes tools.menu.items.list(...).
- The returned JSON input object is passed directly to the runtime as the input global.
- Do not wrap input values under plain, data, args, parameters, or any other container.
- Put reusable constants directly in input and reference them from code, e.g. "input": { "menuName": "Dinner" } and input.menuName.
- Use tools to read current app data before mutating when the task depends on existing state.
- Use await for dependent calls and Promise.all([...]) for independent calls.
- If the task cannot be completed with the available tools, return code that returns an explanation object instead of inventing capabilities. In tagged-html UI mode, return an html explanation instead of a plain object.${uiInstructions}`;
}

function taggedHtmlInstructions(): string {
  return `

Tagged HTML UI mode:
- The runtime provides one UI primitive: html tagged templates.
- Return UI as either return html\`...\`; or return function render() { return html\`...\`; }.
- Use return function render() when the UI needs local component state.
- Keep local component state in normal JavaScript closures with var and function declarations.
- Bind events with function interpolation, e.g. onclick=\${handler}, onsubmit=\${handler}, oninput=\${handler}, or onchange=\${handler}.
- Do not use string event handlers such as onclick="handler()".
- Do not use style attributes; the host compiler strips inline styles.
- Use semantic class names instead of inline styles: surface-card, surface-text, surface-list, surface-actions, surface-item, surface-action, is-selected, surface-table, surface-muted, surface-badge.
- Do not string-build HTML with concatenation, arrays of strings, or template strings that are not tagged with html.
- Do not return { html: "..." }, plain explanation objects, or separate UI JSON.
- If a requested operation is impossible with the available tools, still return html UI that explains the missing capability and shows the relevant data/capabilities that are available.
- Do not use a JSON UI DSL, component catalog, JSX, Svelte syntax, or TypeScript syntax.
- For text and attributes, interpolate values directly in html templates so the host compiler can escape them.
- For lists, use Array.prototype.map and return nested html templates.
- Expose relevant capabilities for rendered entities wherever possible, even in read-oriented views.
- Every entity card or row should include a surface-actions area when matching tools exist and the action can be called with data already available on that entity.
- For example, if tools.menu.item.duplicate exists, menu item rows should include a Duplicate button that calls tools.menu.item.duplicate from an onclick handler.
- For example, if tools.menu.item.delete exists, menu item rows should include a clearly labeled Delete button that calls tools.menu.item.delete from an onclick handler and updates local UI state.
- Keep capabilities explicit and safe: label destructive actions clearly and use app tools inside event handlers for effects.
- For app effects, call tools from event handlers or before returning the render function.

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
    return html\`<article class="surface-item"><span><strong>\${item.name}</strong><span>\${item.price}</span></span><div class="surface-actions"><button type="button" onclick=\${function () { return duplicateItem(item); }}>Duplicate</button><button type="button" onclick=\${function () { return deleteItem(item); }}>Delete</button></div></article>\`;
  })}</div></section>\`;
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
      throw new Error("Generated code plan response did not contain a JSON object.");
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

