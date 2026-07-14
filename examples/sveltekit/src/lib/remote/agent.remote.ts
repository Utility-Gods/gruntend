import { dev } from "$app/environment";
import { command, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  completeSimple,
  type AssistantMessage,
  type TextContent,
} from "@earendil-works/pi-ai";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { createMockPlan } from "$lib/agent/mock-plan";
import { restaurantPlannerInstructions } from "$lib/agent/planner-instructions";
import { appTools } from "$lib/agent/tools";
import {
  checkAgentPlanRateLimit,
  checkAgentSuggestionRateLimit,
  readClientIp,
} from "$lib/server/rate-limit";
import {
  listCustomers,
  listMenus,
  listOrders,
  listPayments,
  listReservations,
  listRestaurantTables,
  listShifts,
  listUsers,
} from "$lib/server/store";
import {
  createCodePlanManifest,
  createCodePlanPrompt,
  generateCodePlan,
  GeneratedCodePlanParseError,
  getModel,
  type Model,
} from "gruntend-sdk/generate";

const generateAgentPlanSchema = v.object({
  prompt: v.pipe(v.string(), v.nonEmpty()),
});

const suggestAgentTaskSchema = v.object({
  draft: v.pipe(v.string(), v.maxLength(1000)),
});

type AgentPlannerMode = "mock" | "openai";

export const getAgentPlannerInfo = query(async () => {
  const mode = resolvePlannerMode();

  return {
    generator: mode === "mock" ? ("mock" as const) : ("pi-ai" as const),
    mode,
    model: mode === "mock" ? "mock-planner" : env.OPENAI_MODEL || "gpt-5.5",
  };
});

export const suggestAgentTask = command(
  suggestAgentTaskSchema,
  async ({ draft }) => {
    const event = getRequestEvent();
    const mode = resolvePlannerMode();
    const rateLimit = await checkAgentSuggestionRateLimit({
      ip: readClientIp(event.request),
      context: { platform: event.platform },
    });
    if (!rateLimit.allowed) {
      return {
        error: `You are rate limited. Try again in about ${formatRetryDelay(rateLimit.resetAt)}.`,
      };
    }

    if (mode === "mock") {
      return {
        generator: "mock" as const,
        model: "mock-task-curator",
        prompt: mockTaskSuggestion(),
      };
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when GRUNTEND_AGENT_MODE=openai.",
      );
    }

    const model = resolveOpenAiModel(env.OPENAI_MODEL || "gpt-5.5");
    const context = { platform: event.platform };
    const [menus, orders, customers, tables, payments, shifts, reservations, users] =
      await Promise.all([
        listMenus(context),
        listOrders(context),
        listCustomers(context),
        listRestaurantTables(context),
        listPayments(context),
        listShifts(context),
        listReservations(context),
        listUsers(context),
      ]);
    const message = await completeSimple(
      model,
      {
        systemPrompt: taskSuggestionSystemPrompt,
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              {
                draft: draft.trim() || undefined,
                requestedFocus: taskSuggestionFocus(),
                capabilities: createCodePlanManifest(appTools),
                restaurant: {
                  menuNames: menus.map((menu) => menu.name),
                  orderStatuses: countBy(orders.map((order) => order.status)),
                  serviceTypes: countBy(
                    orders.map((order) => order.serviceType),
                  ),
                  paidRevenue: payments
                    .filter((payment) => payment.status === "paid")
                    .reduce((total, payment) => total + payment.amount, 0),
                  paymentMethods: countBy(
                    payments
                      .filter((payment) => payment.status === "paid")
                      .map((payment) => payment.method),
                  ),
                  loyaltyTiers: countBy(
                    customers.map((customer) => customer.loyaltyTier),
                  ),
                  tableSections: countBy(
                    tables.map((table) => table.section),
                  ),
                  reservationStatuses: countBy(
                    reservations.map((reservation) => reservation.status),
                  ),
                  staffRoles: countBy(users.map((user) => user.role)),
                  shiftStations: countBy(
                    shifts.map((shift) => shift.station),
                  ),
                },
              },
              null,
              2,
            ),
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey,
        reasoning: model.reasoning ? "low" : undefined,
        maxTokens: 800,
      },
    );

    if (message.stopReason !== "stop") {
      throw new Error(
        message.errorMessage ?? `Task suggestion ${message.stopReason}.`,
      );
    }

    return {
      generator: "pi-ai" as const,
      model: model.id,
      prompt: parseTaskSuggestion(assistantText(message)),
    };
  },
);

export const generateAgentPlan = command(
  generateAgentPlanSchema,
  async ({ prompt }) => {
    const event = getRequestEvent();
    const mode = resolvePlannerMode();
    const startedAt = Date.now();

    console.info("[gruntend planner] request started", {
      mode,
      prompt: dev ? prompt.trim() : undefined,
      promptLength: prompt.trim().length,
    });

    const rateLimit = await checkAgentPlanRateLimit({
      ip: readClientIp(event.request),
      context: { platform: event.platform },
    });
    if (!rateLimit.allowed) {
      error(
        429,
        `Too many planner requests. Try again after ${rateLimit.resetAt.toLocaleTimeString()}.`,
      );
    }

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

    const model = resolveOpenAiModel(env.OPENAI_MODEL || "gpt-5.5");
    const context = { platform: event.platform };
    const promptRequest = {
      tools: appTools,
      task: prompt.trim(),
      input: {
        menus: await listMenus(context),
        orders: await listOrders(context),
        customers: await listCustomers(context),
        tables: await listRestaurantTables(context),
        payments: await listPayments(context),
        shifts: await listShifts(context),
        reservations: await listReservations(context),
        users: await listUsers(context),
      },
      ui: { kind: "tagged-html" as const },
    };
    const defaultPrompt = createCodePlanPrompt(promptRequest);
    const chartRequirement = requiresChart(prompt)
      ? "\n\nRequired output for this task: the generated interface must include a visible, accessible chart. Use native SVG or a registered renderer; do not return only metrics, rows, or a table."
      : "";
    const codePlanPrompt = {
      system: `${defaultPrompt.system}\n\nApplication-owned planning policy:\n${restaurantPlannerInstructions}`,
      user: `${defaultPrompt.user}${chartRequirement}`,
    };
    const generated = await generateWithDiagnostics(async () =>
      generateCodePlan({
        ...promptRequest,
        prompt: codePlanPrompt,
        model,
        options: {
          apiKey,
          reasoning: model.reasoning ? "low" : undefined,
          maxTokens: 5000,
        },
      }),
    );

    console.info("[gruntend planner] request completed", {
      model: model.id,
      responseId: generated.message.responseId,
      stopReason: generated.message.stopReason,
      durationMs: Date.now() - startedAt,
      inputTokens: generated.message.usage.input,
      outputTokens: generated.message.usage.output,
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

async function generateWithDiagnostics<T>(
  generate: () => Promise<T>,
): Promise<T> {
  try {
    return await generate();
  } catch (caught) {
    if (caught instanceof GeneratedCodePlanParseError) {
      console.error("[gruntend planner] invalid model response", {
        message: caught.message,
        extractedText: caught.extractedText,
        responseText: caught.responseText,
      });
      error(
        502,
        dev
          ? `${caught.message}\n\nModel response:\n${caught.responseText}`
          : "The model returned an invalid plan. Please try again.",
      );
    }

    console.error("[gruntend planner] generation failed", {
      message: caught instanceof Error ? caught.message : String(caught),
      stack: caught instanceof Error ? caught.stack : undefined,
    });
    throw caught;
  }
}

const taskSuggestionSystemPrompt = `You curate one exceptional task for a public Gruntend restaurant-operations demo.

Return JSON only, with exactly this shape:
{"prompt":"one ready-to-run task"}

Supported application effects are explicit: create a menu; create, copy, update, or delete menu items; create a staff user; create an order from existing customers, staff, tables, and menu items; and move eligible orders through valid status transitions. Tables, customers, payments, shifts, and reservations are currently read-only. Do not propose unsupported relationships such as assigning a table to a menu, deleting an order, or editing a payment.

Write from the point of view of a busy restaurant owner, not an analyst or developer.

The task must:
- be one plain-language sentence between 8 and 28 words
- follow the supplied requestedFocus
- ask for one recognizable restaurant outcome or decision
- be feasible using only the supplied capabilities and restaurant data
- hide the underlying data relationships and capability calls
- allow the application to coordinate several reads and actions behind the scenes without listing them in the request
- use a chart only when an owner would naturally benefit from a visual comparison
- for every mutation, ask to review the proposed change and confirm it before anything is created, copied, updated, deleted, or changed
- never use analyst language such as investigate, realized revenue, rank, cohort, distribution, correlation, drill-down, derive, or interactive analysis
- never mention Gruntend, tools, handlers, JavaScript, SVG, Canvas, renderers, APIs, databases, prompts, fields, records, or IDs

Use natural requests such as “Help me build…”, “Show me…”, “Which…”, or “Let me review…”. If a draft is supplied, rewrite technical language into the owner’s everyday language while preserving the core goal. Avoid generic dashboards, impossible forecasts, invented information, and decorative visualizations.`;

const suggestionFocuses = [
  "help the owner build a new menu from dishes customers already like",
  "help the owner review and safely update menu prices or tags",
  "help the owner clean up menu items that are no longer useful",
  "help the owner prepare a new order using existing restaurant choices",
  "help the owner move eligible orders to their next status",
  "help the owner understand which reservations became visits",
  "help the owner see how floor staff are performing",
  "help the owner compare sales in a simple visual",
] as const;

const mockTaskSuggestions = [
  "Help me build a Brunch menu from popular vegetarian dishes, then let me review and confirm it.",
  "Show me which popular items are priced too low, then let me review and confirm new prices.",
  "Show me open orders that are ready for the kitchen, then let me confirm which ones to start.",
  "Help me prepare a dine-in order, show the total, and let me review it before creating it.",
  "Show me menu items that are not selling, then let me choose and confirm which ones to remove.",
  "Which reservations became paid visits, and where are we losing guests?",
  "Which floor staff are bringing in the most paid sales and tips? Let me inspect their orders.",
  "Help me build a Happy Hour menu from drinks customers already order, then let me review and confirm it.",
] as const;

function taskSuggestionFocus(): string {
  const index = Math.floor(Math.random() * suggestionFocuses.length);
  return suggestionFocuses[index] ?? suggestionFocuses[0];
}

function mockTaskSuggestion(): string {
  const index = Math.floor(Math.random() * mockTaskSuggestions.length);
  return mockTaskSuggestions[index] ?? mockTaskSuggestions[0];
}

function assistantText(message: AssistantMessage): string {
  return message.content
    .filter((content): content is TextContent => content.type === "text")
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function parseTaskSuggestion(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new Error("The task curator returned invalid JSON.", { cause });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The task curator returned an invalid response.");
  }

  const prompt = (parsed as { readonly prompt?: unknown }).prompt;
  if (typeof prompt !== "string") {
    throw new Error("The task curator did not return a prompt.");
  }

  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length < 12 || normalized.length > 400) {
    throw new Error("The task curator returned an invalid prompt length.");
  }

  return normalized;
}

function formatRetryDelay(resetAt: Date): string {
  const minutes = Math.max(
    1,
    Math.ceil((resetAt.getTime() - Date.now()) / 60_000),
  );
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function requiresChart(task: string): boolean {
  return /\b(?:chart|graph|plot)\b/i.test(task);
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
