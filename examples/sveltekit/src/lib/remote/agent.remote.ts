import { command, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import * as v from "valibot";
import { createMockPlan } from "$lib/agent/mock-plan";
import { appTools } from "$lib/agent/tools";
import { listMenus, listUsers } from "$lib/server/store";
import { generateCodePlan, getModel, type Model } from "gruntend/generate";

const generateAgentPlanSchema = v.object({
  prompt: v.pipe(v.string(), v.nonEmpty()),
});

const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMaxRequests = 5;
const rateLimitBuckets = new Map<
  string,
  { readonly resetAt: number; count: number }
>();

type AgentPlannerMode = "mock" | "openai";

export const getAgentPlannerInfo = query(async () => {
  const mode = resolvePlannerMode();

  return {
    generator: mode === "mock" ? "mock" : "pi-ai",
    mode,
    model: mode === "mock" ? "mock-planner" : env.OPENAI_MODEL || "gpt-5.1",
  };
});

export const generateAgentPlan = command(
  generateAgentPlanSchema,
  async ({ prompt }) => {
    const event = getRequestEvent();
    assertAgentRateLimit(event.getClientAddress());
    const mode = resolvePlannerMode();

    if (mode === "mock") {
      return {
        generator: "mock" as const,
        model: "mock-planner",
        plan: createMockPlan(prompt.trim()),
        stopReason: "stop",
        usage: undefined,
        responseId: `mock_${Date.now()}`,
      };
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when GRUNTEND_AGENT_MODE=openai.",
      );
    }

    const model = resolveOpenAiModel(env.OPENAI_MODEL || "gpt-5.1");
    const context = { platform: event.platform };
    const generated = await generateCodePlan({
      tools: appTools,
      task: prompt.trim(),
      input: {
        menus: await listMenus(context),
        users: await listUsers(context),
      },
      instructions:
        "This is a restaurant admin app. Prefer reusing existing menus and users when names match. Read current app data with tools before mutating when the task depends on existing state.",
      ui: { kind: "tagged-html" },
      model,
      options: {
        apiKey,
        reasoning: model.reasoning ? "low" : undefined,
        maxTokens: 5000,
      },
    });

    return {
      generator: "pi-ai" as const,
      model: model.id,
      plan: generated.plan,
      stopReason: generated.message.stopReason,
      usage: generated.message.usage,
      responseId: generated.message.responseId,
    };
  },
);

function assertAgentRateLimit(clientAddress: string): void {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(clientAddress);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(clientAddress, {
      resetAt: now + rateLimitWindowMs,
      count: 1,
    });
    return;
  }

  bucket.count = bucket.count + 1;
  if (bucket.count > rateLimitMaxRequests) {
    throw new Error(
      "Too many agent planning requests. Please wait a few minutes and try again.",
    );
  }
}

function resolvePlannerMode(): AgentPlannerMode {
  const mode = env.GRUNTEND_AGENT_MODE ?? "mock";

  if (mode === "mock" || mode === "openai") {
    return mode;
  }

  throw new Error('GRUNTEND_AGENT_MODE must be "mock" or "openai".');
}

function resolveOpenAiModel(modelId: string): Model<"openai-responses"> {
  const model = getModel("openai", modelId as never) as
    | Model<"openai-responses">
    | undefined;

  if (!model) {
    throw new Error(
      `Unknown OpenAI model "${modelId}". Set OPENAI_MODEL to a model in the pi-ai registry.`,
    );
  }

  return model;
}
