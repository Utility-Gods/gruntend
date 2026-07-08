import { env } from "$env/dynamic/private";
import { createMockPlan } from "$lib/agent/mock-plan";
import { appTools } from "$lib/agent/tools";
import { listMenus, listUsers } from "$lib/server/store";
import { json } from "@sveltejs/kit";
import { generateCodePlan, getModel, type Model } from "gruntend/generate";
import type { RequestHandler } from "./$types";

type AgentPlannerMode = "mock" | "openai";

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { readonly prompt?: unknown };

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return json({ message: "Prompt is required." }, { status: 400 });
  }

  const prompt = body.prompt.trim();
  const mode = resolvePlannerMode();

  if (mode === "mock") {
    const plan = createMockPlan(prompt);
    return json({
      generator: "mock",
      model: "mock-planner",
      plan,
      stopReason: "stop",
      usage: undefined,
      responseId: `mock_${Date.now()}`,
    });
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(
      { message: "OPENAI_API_KEY is required when GRUNTEND_AGENT_MODE=openai." },
      { status: 500 },
    );
  }

  try {
    const model = resolveOpenAiModel(env.OPENAI_MODEL || "gpt-5.1");
    const generated = await generateCodePlan({
      tools: appTools,
      task: prompt,
      input: {
        menus: listMenus(),
        users: listUsers(),
      },
      instructions:
        "This is a restaurant admin app. Prefer reusing existing menus and users when names match. Read current app data with tools before mutating when the task depends on existing state. If you want to show interactive UI, return an object with an html string from the code plan. Use gr-href semantic paths such as /menus/{menuId}/items/{itemId}/actions/duplicate on controls. Do not return separate UI JSON.",
      model,
      options: {
        apiKey,
        reasoning: model.reasoning ? "low" : undefined,
        maxTokens: 5000,
      },
    });

    return json({
      generator: "pi-ai",
      model: model.id,
      plan: generated.plan,
      stopReason: generated.message.stopReason,
      usage: generated.message.usage,
      responseId: generated.message.responseId,
    });
  } catch (caught) {
    return json(
      { message: caught instanceof Error ? caught.message : "Unable to generate a code plan." },
      { status: 500 },
    );
  }
};

function resolvePlannerMode(): AgentPlannerMode {
  const mode = env.GRUNTEND_AGENT_MODE ?? "mock";

  if (mode === "mock" || mode === "openai") {
    return mode;
  }

  throw new Error('GRUNTEND_AGENT_MODE must be "mock" or "openai".');
}

function resolveOpenAiModel(modelId: string): Model<"openai-responses"> {
  const model = getModel("openai", modelId as never) as Model<"openai-responses"> | undefined;

  if (!model) {
    throw new Error(`Unknown OpenAI model "${modelId}". Set OPENAI_MODEL to a model in the pi-ai registry.`);
  }

  return model;
}
