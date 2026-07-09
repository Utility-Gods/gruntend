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

export interface CodePlanGenerationRequest<TApi extends Api = Api> {
  readonly model: Model<TApi>;
  readonly tools: readonly Tool[];
  readonly task: string;
  readonly input?: unknown;
  readonly instructions?: string;
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
    systemPrompt: codePlanSystemPrompt(),
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

function codePlanSystemPrompt(): string {
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
- parallel(promises)
- console
- html tagged template function, only when the app instructions explicitly say generated UI is available

Rules:
- Do not use imports, require, fetch, window, document, localStorage, process, external APIs, or TypeScript syntax.
- Do not invent tools. Only call tools from the tool manifest.
- Use the exact nested tool namespace implied by dot-separated names, e.g. menu.items.list becomes tools.menu.items.list(...).
- The returned JSON input object is passed directly to the runtime as the input global.
- Do not wrap input values under plain, data, args, parameters, or any other container.
- Put reusable constants directly in input and reference them from code, e.g. "input": { "menuName": "Dinner" } and input.menuName.
- Use tools to read current app data before mutating when the task depends on existing state.
- Use await for dependent calls and parallel([...]) for independent calls.
- If app instructions ask for generated UI, return html\`...\` for simple UI or return a render function that returns html\`...\` for local state.
- Do not return raw HTML strings for generated UI.
- If the task cannot be completed with the available tools, return code that returns an explanation object instead of inventing capabilities.`;
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
