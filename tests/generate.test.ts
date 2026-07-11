import { expect, test } from "vitest";
import {
  createCodePlanManifest,
  createCodePlanPrompt,
  generateCodePlan,
  GeneratedCodePlanParseError,
  parseGeneratedCodePlan,
  type CodePlanGenerationComplete,
  type CodePlanGenerationRequest,
  type CodePlanGenerationResponse,
} from "../src/generate.ts";
import { defineTools, type StandardSchemaV1 } from "../src/tool.ts";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";

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

test("createCodePlanPrompt exposes provider-neutral prompts for custom model calls", () => {
  const prompt = createCodePlanPrompt({
    tools,
    task: "Create a lunch menu",
    input: { currentMenus: [] },
    instructions: "Reuse an existing menu when possible.",
    ui: { kind: "tagged-html" },
  });

  expect(prompt.system).toContain(
    "You generate Gruntend JavaScript code plans",
  );
  expect(prompt.system).toContain("Tagged HTML UI mode");
  expect(JSON.parse(prompt.user)).toEqual({
    task: "Create a lunch menu",
    instructions: "Reuse an existing menu when possible.",
    input: { currentMenus: [] },
    tools: createCodePlanManifest(tools),
  });
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

  expect(() =>
    parseGeneratedCodePlan('{"summary":"Missing code","input":{}}'),
  ).toThrow('Generated code plan must include a non-empty "code" string.');
});

test("parseGeneratedCodePlan exposes the raw response when JSON is invalid", () => {
  const text = '{"summary":"Broken","input":{},"code":"bad\\q"}';

  try {
    parseGeneratedCodePlan(text);
    throw new Error("Expected parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(GeneratedCodePlanParseError);
    expect((error as GeneratedCodePlanParseError).responseText).toBe(text);
    expect((error as GeneratedCodePlanParseError).message).toContain(
      "Could not parse generated code plan JSON",
    );
  }
});

test("generateCodePlan enables tagged-html UI mode", async () => {
  const complete: CodePlanGenerationComplete<"openai-responses"> = async (
    _receivedModel,
    context,
  ) => {
    expect(context.systemPrompt).toContain("- html");
    expect(context.systemPrompt).toContain("Tagged HTML UI mode");
    expect(String(context.messages[0].content)).toContain(
      "Show selectable menu UI",
    );
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
  const complete: CodePlanGenerationComplete<"openai-responses"> = async (
    receivedModel,
    context,
    options,
  ) => {
    expect(receivedModel).toBe(model);
    expect(context.systemPrompt).toContain("Return JSON only");
    expect(context.systemPrompt).toContain("Do not wrap input values");
    expect(context.messages[0].role).toBe("user");
    expect(String(context.messages[0].content)).toContain(
      "Create a lunch menu",
    );
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
