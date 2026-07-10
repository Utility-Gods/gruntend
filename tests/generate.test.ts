import { expect, test } from "vitest";
import {
  createCodePlanManifest,
  generateCodePlan,
  parseGeneratedCodePlan,
  type CodePlanGenerationComplete,
  type CodePlanGenerationRequest,
  type CodePlanGenerationResponse,
} from "../src/generate.ts";
import { defineTools, type StandardSchemaV1 } from "../src/tool.ts";
import type { AssistantMessage, Model } from "@mariozechner/pi-ai";

function schema<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "gruntend-test",
      validate(value) {
        return { value: value as T };
      },
    },
  };
}

const tools = defineTools({
  menus: {
    create: {
      description: "Create a menu.",
      input: schema<{ name: string }>(),
      output: schema<{ menu: { menuId: string; name: string } }>(),
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
      returns: {
        type: "object",
        properties: {
          menu: {
            type: "object",
            properties: {
              menuId: { type: "string" },
              name: { type: "string" },
            },
          },
        },
      },
    },
  },
});

const model: Model<"openai-responses"> = {
  id: "test-model",
  name: "Test Model",
  api: "openai-responses",
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 1000,
};

const message: AssistantMessage = {
  role: "assistant",
  api: "openai-responses",
  provider: "openai",
  model: "test-model",
  content: [
    {
      type: "text",
      text: '{"summary":"Create lunch","input":{"name":"Lunch"},"code":"return input.name;"}',
    },
  ],
  usage: {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 456,
};

test("createCodePlanManifest emits explicit model-facing tool data", () => {
  expect(createCodePlanManifest(tools)).toEqual([
    {
      name: "menus.create",
      description: "Create a menu.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
      returns: {
        type: "object",
        properties: {
          menu: {
            type: "object",
            properties: {
              menuId: { type: "string" },
              name: { type: "string" },
            },
          },
        },
      },
    },
  ]);
});

test("parseGeneratedCodePlan parses and validates an LLM text response", () => {
  expect(
    parseGeneratedCodePlan(`\`\`\`json
{"summary":"Create lunch","input":{"name":"Lunch"},"code":"return input.name;"}
\`\`\``),
  ).toEqual({
    summary: "Create lunch",
    input: { name: "Lunch" },
    code: "return input.name;",
  });

  expect(
    parseGeneratedCodePlan(
      '{"summary":"Create lunch","input":{"plain":{"name":"Lunch"}},"code":"return input.name;"}',
    ),
  ).toEqual({
    summary: "Create lunch",
    input: { name: "Lunch" },
    code: "return input.name;",
  });

  expect(() => parseGeneratedCodePlan('{"summary":"Missing code","input":{}}')).toThrow(
    'Generated code plan must include a non-empty "code" string.',
  );
});

test("generateCodePlan adds tagged-html UI instructions when requested", async () => {
  const complete: CodePlanGenerationComplete<"openai-responses"> = async (_receivedModel, context) => {
    expect(context.systemPrompt).toContain("- html");
    expect(context.systemPrompt).toContain("return html`");
    expect(context.systemPrompt).toContain("return function render()");
    expect(context.systemPrompt).toContain("onclick=${handler}");
    expect(context.systemPrompt).toContain("Do not use style attributes");
    expect(context.systemPrompt).toContain("surface-card");
    expect(context.systemPrompt).toContain("surface-table");
    expect(context.systemPrompt).toContain("Do not string-build HTML");
    expect(context.systemPrompt).toContain('Do not return { html: "..." }');
    expect(context.systemPrompt).toContain("return an html explanation instead of a plain object");
    expect(context.systemPrompt).toContain("If a requested operation is impossible with the available tools, still return html UI");
    expect(context.systemPrompt).toContain("Keep local component state in normal JavaScript closures");
    expect(context.systemPrompt).toContain("Expose relevant capabilities for rendered entities wherever possible");
    return message;
  };

  await generateCodePlan({
    model,
    tools,
    task: "Show selectable menu UI",
    ui: { kind: "tagged-html" },
    complete,
  });
});

test("generateCodePlan is the typed LLM boundary", async () => {
  const complete: CodePlanGenerationComplete<"openai-responses"> = async (receivedModel, context, options) => {
    expect(receivedModel).toBe(model);
    expect(context.systemPrompt).toContain("Return JSON only");
    expect(context.systemPrompt).toContain("Do not wrap input values");
    expect(context.messages[0].role).toBe("user");
    expect(String(context.messages[0].content)).toContain("Create a lunch menu");
    expect(String(context.messages[0].content)).toContain("menus.create");
    expect(String(context.messages[0].content)).toContain("currentMenus");
    expect(options).toEqual({ apiKey: "test-key", maxTokens: 100 });
    return message;
  };
  const request: CodePlanGenerationRequest<"openai-responses"> = {
    model,
    tools,
    task: "Create a lunch menu",
    input: { currentMenus: [] },
    options: { apiKey: "test-key", maxTokens: 100 },
    complete,
  };

  const response: CodePlanGenerationResponse = await generateCodePlan(request);

  expect(response).toEqual({
    plan: {
      summary: "Create lunch",
      input: { name: "Lunch" },
      code: "return input.name;",
    },
    text: '{"summary":"Create lunch","input":{"name":"Lunch"},"code":"return input.name;"}',
    message,
  });
});
