import { env } from "$env/dynamic/private";
import { appTools } from "$lib/agent/tools";
import { listMenus, listUsers } from "$lib/server/store";
import { json } from "@sveltejs/kit";
import { generateCodePlan, getModel, type Model } from "gruntend/generate";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  console.info("[gruntend example] POST /api/agent/plan received");
  const body = (await request.json()) as { readonly prompt?: unknown };

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    console.info("[gruntend example] rejected: missing prompt");
    return json({ message: "Prompt is required." }, { status: 400 });
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.info("[gruntend example] rejected: OPENAI_API_KEY is missing");
    return json({ message: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const model = resolveOpenAiModel(env.OPENAI_MODEL || "gpt-5.1");
    console.info("[gruntend example] calling pi-ai/OpenAI", {
      model: model.id,
      prompt: body.prompt,
      keyConfigured: true,
    });
    const generated = await generateCodePlan({
      tools: appTools,
      task: body.prompt,
      input: {
        menus: listMenus(),
        users: listUsers(),
      },
      instructions:
        "This is a restaurant admin app. Prefer reusing existing menus and users when names match. Read current app data with tools before mutating when the task depends on existing state.",
      model,
      options: {
        apiKey,
        reasoning: model.reasoning ? "low" : undefined,
        maxTokens: 5000,
      },
    });

    console.info("[gruntend example] pi-ai/OpenAI completed", {
      model: model.id,
      stopReason: generated.message.stopReason,
      usage: generated.message.usage,
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
    console.error("[gruntend example] pi-ai/OpenAI generation failed", caught);
    return json(
      { message: caught instanceof Error ? caught.message : "Unable to generate a code plan." },
      { status: 500 },
    );
  }
};

function resolveOpenAiModel(modelId: string): Model<"openai-responses"> {
  const model = getModel("openai", modelId as never) as Model<"openai-responses"> | undefined;

  if (!model) {
    throw new Error(`Unknown OpenAI model "${modelId}". Set OPENAI_MODEL to a model in the pi-ai registry.`);
  }

  return model;
}
