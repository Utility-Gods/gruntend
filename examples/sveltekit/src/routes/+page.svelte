<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import {
    Activity,
    BarChart3,
    ChartNoAxesCombined,
    BadgeDollarSign,
    CheckCircle2,
    Copy,
    CreditCard,
    MousePointerClick,
    Salad,
    Sparkles,
    Tags,
    TrendingUp,
  } from "@lucide/svelte";
  import { gruntend } from "$lib/agent/client";
  import { createBrowserHandlers } from "$lib/agent/handlers";
  import {
    generateAgentPlan,
    suggestAgentTask,
  } from "$lib/remote/agent.remote";
  import {
    getMenusWithItems,
    getOrders,
    getUsers,
  } from "$lib/remote/example.remote";
  import type { GeneratedCodePlan } from "gruntend-sdk/generate";
  import type { RuntimeEvent } from "gruntend-sdk/runtime";
  import {
    createGeneratedUi,
    createHtmlTag,
    type GeneratedUi as GeneratedUiModel,
  } from "gruntend-sdk/ui";
  import GeneratedUi from "gruntend-sdk/ui/svelte";
  import { toast } from "svelte-sonner";

  type RunState = "idle" | "planning" | "running" | "done" | "error";
  type ShowcaseTaskKind =
    | "price"
    | "menu"
    | "tags"
    | "copy"
    | "svg-chart"
    | "interactive-chart"
    | "line-chart"
    | "payment-chart"
    | "loyalty-chart";
  type ShowcaseTask = {
    readonly id: string;
    readonly kind: ShowcaseTaskKind;
    readonly label: string;
    readonly prompt: string;
    readonly requiresAction: boolean;
  };
  type AppliedAction = {
    readonly mutationCount: number;
    readonly tools: readonly string[];
    readonly itemIds: readonly string[];
    readonly menuIds: readonly string[];
    readonly orderIds: readonly string[];
  };
  type AgentGenerationEnvelope = {
    readonly generator: "mock" | "pi-ai";
    readonly model?: string;
    readonly plan: GeneratedCodePlan;
  };

  const showcaseTasks = [
    {
      id: "price-review",
      kind: "price",
      label: "Review low-price increases",
      prompt:
        "Find every item under $10, preview a 20% price increase, and let me confirm before applying it",
      requiresAction: true,
    },
    {
      id: "vegetarian-menu",
      kind: "menu",
      label: "Build a vegetarian menu",
      prompt:
        "Create a Vegetarian Specials menu by copying existing vegetarian items, and let me confirm before creating it",
      requiresAction: true,
    },
    {
      id: "seasonal-tags",
      kind: "tags",
      label: "Tag seasonal drinks",
      prompt:
        "Find drinks under $7, preview adding a seasonal tag, and let me confirm before applying it",
      requiresAction: true,
    },
    {
      id: "copy-popular",
      kind: "copy",
      label: "Copy popular dinner items",
      prompt:
        "Copy popular Dinner items into the Brunch menu after I review and confirm the items",
      requiresAction: true,
    },
    {
      id: "weekly-revenue",
      kind: "svg-chart",
      label: "Review weekly revenue",
      prompt: "Show paid revenue by day for the past week in a bar chart",
      requiresAction: false,
    },
    {
      id: "popular-items",
      kind: "interactive-chart",
      label: "Explore popular dishes",
      prompt:
        "Show the best-selling dishes by quantity and let me select a bar to inspect sales details",
      requiresAction: false,
    },
    {
      id: "order-status-mix",
      kind: "svg-chart",
      label: "See order status mix",
      prompt:
        "Show a compact chart comparing the number of open, preparing, served, and cancelled orders",
      requiresAction: false,
    },
    {
      id: "average-ticket-line",
      kind: "line-chart",
      label: "Track average ticket",
      prompt: "Show the average paid order value by day in a line chart",
      requiresAction: false,
    },
    {
      id: "floor-performance",
      kind: "interactive-chart",
      label: "Compare floor performance",
      prompt:
        "Compare paid sales, tips, and completed orders for each assigned manager or server in an interactive bar chart",
      requiresAction: false,
    },
    {
      id: "reservation-outcomes",
      kind: "svg-chart",
      label: "Review reservation outcomes",
      prompt:
        "Show reservation outcomes in a bar chart and identify which reservations converted into orders",
      requiresAction: false,
    },
    {
      id: "payment-methods",
      kind: "payment-chart",
      label: "Compare payment methods",
      prompt:
        "Compare paid revenue and tips by payment method in a grouped bar chart",
      requiresAction: false,
    },
    {
      id: "loyalty-revenue",
      kind: "loyalty-chart",
      label: "Explore loyalty revenue",
      prompt:
        "Show paid revenue by customer loyalty tier in an interactive bar chart with order count and average ticket details",
      requiresAction: false,
    },
  ] as const satisfies readonly ShowcaseTask[];

  const mutationTools = new Set([
    "menus.create",
    "menu.item.create",
    "menu.item.duplicate",
    "menu.item.update",
    "menu.item.delete",
    "users.create",
    "orders.create",
    "orders.status.update",
  ]);

  const taggedHtml = createHtmlTag();
  const menusResponse = $derived(getMenusWithItems().current);
  const ordersResponse = $derived(getOrders().current);
  const usersResponse = $derived(getUsers().current);
  const menuCount = $derived(menusResponse?.menus.length);
  const itemCount = $derived(
    menusResponse?.menus.reduce((total, menu) => total + menu.items.length, 0),
  );
  const orderCount = $derived(ordersResponse?.orders.length);
  const teamCount = $derived(usersResponse?.users.length);

  let prompt = $state("");
  let suggestionLoading = $state(false);
  let state = $state<RunState>("idle");
  let resultUi = $state<GeneratedUiModel>();
  let resultTitle = $state("");
  let errorMessage = $state("");
  let debugDetails = $state("");
  let toolCallCount = $state(0);
  let completedToolCallCount = $state(0);
  let runtimeActivity = $state(
    "Waiting for the model to return a JavaScript plan",
  );
  let generatedActionError = $state("");
  let generatedActionRunning = $state(false);
  let actionMutationCount = $state(0);
  let actionTools = $state<string[]>([]);
  let actionItemIds = $state<string[]>([]);
  let actionMenuIds = $state<string[]>([]);
  let actionOrderIds = $state<string[]>([]);
  let lastAction = $state<AppliedAction>();
  let promptInput: HTMLTextAreaElement;

  function loadingProgressLabel() {
    if (suggestionLoading) return "Generating a task suggestion";
    if (state === "planning") return "Generating the code plan";
    return runtimeActivity;
  }

  function chooseSuggestion(suggestion: string) {
    prompt = suggestion;
    toast.dismiss();
    promptInput.focus();
  }

  async function generateTaskSuggestion() {
    if (suggestionLoading || state === "planning" || state === "running") {
      return;
    }

    const startingPrompt = prompt;
    suggestionLoading = true;
    toast.dismiss();
    try {
      const suggestion = await suggestAgentTask({
        draft: startingPrompt.trim(),
      });
      if ("error" in suggestion) {
        toast.error(suggestion.error);
        return;
      }
      if (prompt !== startingPrompt) {
        toast.info(
          "Your request changed, so the AI suggestion was not applied.",
        );
        return;
      }
      prompt = suggestion.prompt;
      toast.success("AI suggestion ready", {
        description: "Review or edit it before running.",
      });
      promptInput.focus();
    } catch (caught) {
      toast.error("AI suggestion failed", {
        description: readErrorMessage(caught),
      });
    } finally {
      suggestionLoading = false;
    }
  }

  function submitTask() {
    const task = prompt.trim();
    if (!task) {
      toast.error("Describe an operation first", {
        description: "Enter a request or choose one of the suggestions.",
      });
      return;
    }
    toast.dismiss();
    void runTask(task);
  }

  async function runTask(task: string) {
    if (state === "planning" || state === "running") return;

    prompt = task;
    state = "planning";
    resultUi = undefined;
    resultTitle = "Understanding your request";
    errorMessage = "";
    debugDetails = "";
    toolCallCount = 0;
    completedToolCallCount = 0;
    runtimeActivity = "Waiting for the model to return a JavaScript plan";
    lastAction = undefined;
    generatedActionError = "";

    try {
      const envelope = (await generateAgentPlan({
        prompt: task,
      })) as AgentGenerationEnvelope;
      const plan = envelope.plan;
      resultTitle = plan.summary;
      debugDetails = JSON.stringify(
        {
          generator: envelope.generator,
          model: envelope.model,
          summary: plan.summary,
          input: plan.input,
          code: plan.code,
        },
        null,
        2,
      );

      state = "running";
      runtimeActivity = "Starting the controlled interpreter";
      const result = await gruntend.runCodePlan(plan.code, {
        id: "restaurant-dashboard-plan",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers({
          canMutate: () => generatedActionRunning,
        }),
        ui: { html: taggedHtml },
        onEvent: recordEvent,
      });

      if (result.status === "failed") {
        throw new Error(result.error ?? "The requested operation failed.");
      }

      const ui = createGeneratedUi(result.result);
      if (ui.status !== "ok") {
        throw new Error("The request did not produce a result.");
      }

      const frame = ui.value.render();
      if (frame.status !== "ok") {
        throw new Error(frame.unwrapError().message);
      }

      const showcaseTask = showcaseTasks.find(
        (candidate) => candidate.prompt === task,
      );
      if (
        showcaseTask?.requiresAction &&
        Object.keys(frame.value.handlers).length === 0
      ) {
        throw new Error(
          "The generated plan did not provide the required confirmation action. Please run the task again.",
        );
      }

      resultUi = ui.value;
      state = "done";
    } catch (caught) {
      state = "error";
      errorMessage = readErrorMessage(caught);
      debugDetails = [
        debugDetails,
        caught instanceof Error
          ? caught.stack || caught.message
          : JSON.stringify(caught, null, 2),
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  function recordEvent(event: RuntimeEvent) {
    console.debug("[juniper operation]", event);

    if (event.type === "plan.started") {
      runtimeActivity = "Interpreter started with registered application tools";
    } else if (event.type === "tool.started") {
      toolCallCount += 1;
      runtimeActivity = `Calling ${event.tool}`;
    } else if (event.type === "tool.retrying") {
      runtimeActivity = `Retrying ${event.tool} · attempt ${event.nextAttempt} of ${event.maxAttempts}`;
    } else if (event.type === "tool.completed") {
      completedToolCallCount += 1;
      runtimeActivity = `${event.tool} returned validated output`;
    } else if (event.type === "tool.failed") {
      runtimeActivity = `${event.tool} failed`;
    } else if (event.type === "plan.completed") {
      runtimeActivity = "Plan completed · preparing the generated interface";
    } else if (event.type === "plan.failed") {
      runtimeActivity = "Plan execution failed";
    }

    if (
      event.type !== "tool.completed" ||
      !generatedActionRunning ||
      !mutationTools.has(event.tool)
    ) {
      return;
    }

    actionMutationCount += 1;
    actionTools = unique([...actionTools, event.tool]);

    const output = event.output.value as {
      readonly item?: { readonly itemId?: string; readonly menuId?: string };
      readonly menu?: { readonly menuId?: string };
      readonly order?: { readonly orderId?: string };
    };
    if (output.item?.itemId) {
      actionItemIds = unique([...actionItemIds, output.item.itemId]);
    }
    if (output.item?.menuId) {
      actionMenuIds = unique([...actionMenuIds, output.item.menuId]);
    }
    if (output.menu?.menuId) {
      actionMenuIds = unique([...actionMenuIds, output.menu.menuId]);
    }
    if (output.order?.orderId) {
      actionOrderIds = unique([...actionOrderIds, output.order.orderId]);
    }
  }

  function beginGeneratedAction() {
    generatedActionRunning = true;
    generatedActionError = "";
    actionMutationCount = 0;
    actionTools = [];
    actionItemIds = [];
    actionMenuIds = [];
    actionOrderIds = [];
    toast.dismiss();
  }

  function finishGeneratedAction(
    status: "done" | "error",
    error: unknown = undefined,
  ) {
    generatedActionRunning = false;

    if (status === "error") {
      generatedActionError = readErrorMessage(error);
      toast.error("The generated action failed", {
        description: "Review the error below and try again.",
      });
      return;
    }

    if (actionMutationCount === 0) return;

    lastAction = {
      mutationCount: actionMutationCount,
      tools: actionTools,
      itemIds: actionItemIds,
      menuIds: actionMenuIds,
      orderIds: actionOrderIds,
    };
    toast.success(
      `${actionMutationCount} confirmed ${actionMutationCount === 1 ? "change" : "changes"} saved`,
      {
        description: "The updated records are now visible in the application.",
      },
    );
    void refreshDashboardData();
  }

  async function refreshDashboardData() {
    await Promise.all([
      getMenusWithItems().refresh(),
      getOrders().refresh(),
      getUsers().refresh(),
    ]);
  }

  function changedRecordsHref() {
    if (lastAction?.orderIds.length) {
      return `${base}/orders?changed=${lastAction.orderIds.join(",")}`;
    }
    if (!lastAction) return `${base}/menus`;

    const parameters = new URLSearchParams();
    if (lastAction.menuIds[0]) parameters.set("menu", lastAction.menuIds[0]);
    if (lastAction.itemIds.length > 0) {
      parameters.set("changed", lastAction.itemIds.join(","));
    }
    const query = parameters.toString();
    return `${base}/menus${query ? `?${query}` : ""}`;
  }

  function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
  }

  function readErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { readonly message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return "The operation could not be completed.";
  }

  function handleGeneratedLinkClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target) return;
    const href = anchor.getAttribute("href");
    if (!href?.startsWith("/")) return;
    event.preventDefault();
    void goto(`${base}${href}`);
  }
</script>

<div class="space-y-7">
  <section
    class="overflow-hidden border border-neutral-200 border-t-4 border-t-primary-600 bg-white shadow-sm"
  >
    <div class="flex min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 md:px-8">
      <div
        class="flex flex-col justify-between gap-5 md:flex-row md:items-start"
      >
        <div class="max-w-2xl">
          <p
            class="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600"
          >
            Restaurant operations
          </p>
          <h1
            class="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
          >
            What do you want to do?
          </h1>
        </div>
        <dl
          class="grid w-full grid-cols-2 border-l border-t border-neutral-200 bg-[#faf9f6] sm:grid-cols-4 md:w-auto"
        >
          <div class="min-w-0 border-b border-r border-neutral-200 px-3 py-2.5 sm:px-4">
            <dt class="text-[11px] text-neutral-500">Menus</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {menuCount ?? "…"}
            </dd>
          </div>
          <div class="min-w-0 border-b border-r border-neutral-200 px-3 py-2.5 sm:px-4">
            <dt class="text-[11px] text-neutral-500">Items</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {itemCount ?? "…"}
            </dd>
          </div>
          <div class="min-w-0 border-b border-r border-neutral-200 px-3 py-2.5 sm:px-4">
            <dt class="text-[11px] text-neutral-500">Orders</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {orderCount ?? "…"}
            </dd>
          </div>
          <div class="min-w-0 border-b border-r border-neutral-200 px-3 py-2.5 sm:px-4">
            <dt class="text-[11px] text-neutral-500">Staff</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {teamCount ?? "…"}
            </dd>
          </div>
        </dl>
      </div>

      <form
        class="border-t border-neutral-200 pt-5"
        onsubmit={(event) => {
          event.preventDefault();
          submitTask();
        }}
      >
        <div
          class="border border-neutral-300 bg-white transition focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100"
        >
          <textarea
            bind:this={promptInput}
            bind:value={prompt}
            rows="4"
            aria-label="Describe the restaurant operation"
            class="block min-h-28 w-full resize-y bg-transparent px-4 py-3.5 text-sm leading-6 text-slate-950 outline-none placeholder:text-neutral-400"
            placeholder="Move selected dinner items to a new seasonal menu..."
          ></textarea>
          <div
            class="flex flex-col gap-2 border-t border-neutral-200 bg-[#faf9f6] px-2.5 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
          >
            <button
              type="button"
              class="inline-flex h-10 w-full items-center justify-center gap-2 border border-neutral-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-primary-500 hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              disabled={suggestionLoading ||
                state === "planning" ||
                state === "running"}
              onclick={generateTaskSuggestion}
            >
              <Sparkles
                class={suggestionLoading ? "motion-safe:animate-pulse" : ""}
                size={17}
                strokeWidth={2.1}
              />
              {suggestionLoading ? "Thinking..." : "Suggest with AI"}
            </button>
            <button
              type="submit"
              class="h-10 w-full bg-primary-600 px-5 text-sm font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-24"
              disabled={state === "planning" || state === "running"}
            >
              {state === "planning"
                ? "Working..."
                : state === "running"
                  ? "Preparing..."
                  : "Run"}
            </button>
          </div>
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {#each showcaseTasks as task (task.id)}
            <button
              type="button"
              aria-pressed={prompt === task.prompt}
              class={`group flex min-h-11 w-full items-center gap-2.5 border px-3 py-2 text-left transition ${
                prompt === task.prompt
                  ? "border-primary-600 bg-white"
                  : "border-neutral-200 bg-[#faf9f6] hover:border-primary-600 hover:bg-white"
              }`}
              onclick={() => chooseSuggestion(task.prompt)}
            >
              <span class="text-primary-600">
                {#if task.kind === "price"}
                  <TrendingUp size={19} strokeWidth={2.1} />
                {:else if task.kind === "menu"}
                  <Salad size={19} strokeWidth={2.1} />
                {:else if task.kind === "tags"}
                  <Tags size={19} strokeWidth={2.1} />
                {:else if task.kind === "copy"}
                  <Copy size={19} strokeWidth={2.1} />
                {:else if task.kind === "svg-chart"}
                  <BarChart3 size={19} strokeWidth={2.1} />
                {:else if task.kind === "interactive-chart"}
                  <MousePointerClick size={19} strokeWidth={2.1} />
                {:else if task.kind === "payment-chart"}
                  <CreditCard size={19} strokeWidth={2.1} />
                {:else if task.kind === "loyalty-chart"}
                  <BadgeDollarSign size={19} strokeWidth={2.1} />
                {:else}
                  <ChartNoAxesCombined size={19} strokeWidth={2.1} />
                {/if}
              </span>
              <strong
                class="min-w-0 flex-1 text-xs font-semibold leading-5 text-slate-900 group-hover:text-primary-600"
              >
                {task.label}
              </strong>
            </button>
          {/each}
        </div>
      </form>
    </div>

    {#if state !== "idle" || suggestionLoading}
      <div class="border-t border-neutral-200 bg-white" aria-live="polite">
        {#if !suggestionLoading && (state === "done" || state === "error")}
          <header
            class="flex flex-col items-start gap-2 border-b border-neutral-200 bg-[#faf9f6] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 md:px-8"
          >
            <h2 class="text-base font-semibold text-slate-950">
              {resultTitle}
            </h2>
            {#if state === "done"}
              <span
                class="bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
              >
                Ready · {toolCallCount} tool call{toolCallCount === 1
                  ? ""
                  : "s"}
              </span>
            {/if}
          </header>
        {/if}

        <div class="min-w-0 p-4 sm:p-5 md:p-6">
          {#if suggestionLoading || state === "planning" || state === "running"}
            <div class="mx-auto flex max-w-2xl items-start gap-4 py-5">
              <Activity
                class="mt-0.5 shrink-0 text-primary-600"
                size={24}
                strokeWidth={2.3}
              />
              <div class="min-w-0 flex-1">
                <div
                  class="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <p class="text-sm font-semibold text-slate-900">
                    {#if suggestionLoading}
                      Generating a task suggestion
                    {:else if state === "planning"}
                      Generating a JavaScript plan
                    {:else}
                      Interpreting the plan
                    {/if}
                  </p>
                  <span
                    class="text-xs font-medium tabular-nums text-neutral-500"
                  >
                    {#if suggestionLoading || state === "planning"}
                      Model generation
                    {:else}
                      {completedToolCallCount}/{toolCallCount} tool calls
                    {/if}
                  </span>
                </div>
                {#key runtimeActivity}
                  <p
                    class="live-event mt-1 font-mono text-[11px] leading-5 text-neutral-500"
                    aria-live="polite"
                  >
                    {#if suggestionLoading}
                      Waiting for the model to return a task suggestion
                    {:else}
                      {runtimeActivity}
                    {/if}
                  </p>
                {/key}
                <div
                  class="mt-2 h-1.5 overflow-hidden bg-neutral-100"
                  role="progressbar"
                  aria-label={loadingProgressLabel()}
                >
                  <div
                    class="live-progress-indicator h-full bg-primary-600"
                  ></div>
                </div>
              </div>
            </div>
          {:else if state === "error"}
            <div class="border-l-4 border-red-500 bg-red-50 p-4">
              <h3 class="font-semibold text-red-900">
                This task could not be prepared
              </h3>
              <p class="mt-1 text-sm text-red-700">{errorMessage}</p>
            </div>
            {#if debugDetails}
              <details
                class="mt-4 bg-neutral-50 p-3 text-xs leading-5 text-neutral-600"
              >
                <summary class="cursor-pointer font-semibold"
                  >Technical details</summary
                >
                <pre
                  class="mt-3 overflow-auto whitespace-pre-wrap">{debugDetails}</pre>
              </details>
            {/if}
          {:else if resultUi}
            <div
              class="generated-workspace"
              role="presentation"
              onclick={handleGeneratedLinkClick}
              onkeydown={() => undefined}
            >
              <GeneratedUi
                ui={resultUi}
                onActionStart={beginGeneratedAction}
                onActionEnd={(event) =>
                  finishGeneratedAction(event.status, event.error)}
                onError={(error) => {
                  console.error("Generated UI failed", error);
                  generatedActionError = readErrorMessage(error);
                  toast.error("The generated action failed", {
                    description: "Review the error below and try again.",
                  });
                }}
              />
              {#if generatedActionError}
                <div
                  class="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3"
                  role="alert"
                >
                  <h3 class="text-sm font-semibold text-red-950">
                    Generated action failed
                  </h3>
                  <p class="mt-1 text-xs leading-5 text-red-800">
                    {generatedActionError}
                  </p>
                </div>
              {/if}
              {#if lastAction}
                <aside
                  class="mt-5 flex flex-col gap-4 border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center"
                  aria-live="polite"
                >
                  <CheckCircle2
                    class="shrink-0 text-emerald-700"
                    size={22}
                    strokeWidth={2.2}
                  />
                  <div class="min-w-0 flex-1">
                    <h3 class="text-sm font-semibold text-emerald-950">
                      Application data updated
                    </h3>
                    <p class="mt-0.5 text-xs leading-5 text-emerald-800">
                      {lastAction.mutationCount} confirmed handler
                      {lastAction.mutationCount === 1
                        ? " call has"
                        : " calls have"}
                      completed. Mutation handlers were enabled only for this generated
                      action, and the application records now reflect the result.
                    </p>
                    <p
                      class="mt-1 font-mono text-[10px] leading-4 text-emerald-700"
                    >
                      {lastAction.tools.join(" · ")}
                    </p>
                  </div>
                  <a
                    class="shrink-0 border border-emerald-700 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    href={changedRecordsHref()}
                  >
                    View updated records →
                  </a>
                </aside>
              {/if}
              {#if debugDetails}
                <details class="mt-5 border-t border-neutral-200 pt-4">
                  <summary
                    class="cursor-pointer text-xs font-semibold text-neutral-600 hover:text-primary-700"
                  >
                    Inspect the generated JavaScript plan
                  </summary>
                  <pre
                    class="mt-3 max-h-96 overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-200">{debugDetails}</pre>
                </details>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .live-event {
    animation: live-event-in 180ms ease-out;
  }
  .live-progress-indicator {
    width: 36%;
    animation: live-progress 1.4s ease-in-out infinite;
  }
  @keyframes live-event-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
  }
  @keyframes live-progress {
    from {
      transform: translateX(-110%);
    }
    to {
      transform: translateX(310%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .live-event,
    .live-progress-indicator {
      animation: none;
    }
    .live-progress-indicator {
      width: 100%;
      opacity: 0.65;
    }
  }
  :global(.generated-workspace) {
    min-width: 0;
  }
  :global(.generated-workspace .surface-card) {
    display: grid;
    gap: 1rem;
  }
  :global(.generated-workspace .surface-title) {
    color: #0f172a;
    font-size: 1.15rem;
    font-weight: 650;
  }
  :global(.generated-workspace .surface-text),
  :global(.generated-workspace .surface-muted) {
    color: #525252;
  }
  :global(.generated-workspace .surface-badge) {
    display: inline-flex;
    background: #fff7ed;
    color: #c2410c;
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  :global(.generated-workspace .surface-list) {
    display: grid;
    border-top: 1px solid #e5e5e5;
  }
  :global(.generated-workspace .surface-item) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 0;
    border-bottom: 1px solid #e5e5e5;
    background: white;
    padding: 0.9rem 0;
    color: #0f172a;
    text-align: left;
  }
  :global(.generated-workspace .surface-item.is-selected) {
    background: #fff7ed;
    box-shadow: inset 3px 0 #f54a00;
    padding-inline: 0.8rem;
  }
  :global(.generated-workspace .surface-item strong),
  :global(.generated-workspace .surface-item span) {
    display: block;
  }
  :global(.generated-workspace .surface-item span span) {
    color: #737373;
    font-size: 0.85rem;
  }
  :global(.generated-workspace .surface-actions) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    padding-top: 0.5rem;
  }
  :global(.generated-workspace button),
  :global(.generated-workspace a.surface-action) {
    border: 1px solid #f54a00;
    background: #f54a00;
    color: white;
    padding: 0.65rem 0.9rem;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
  }
  :global(.generated-workspace button:hover),
  :global(.generated-workspace a.surface-action:hover) {
    background: #c2410c;
    border-color: #c2410c;
  }
  :global(.generated-workspace .surface-chart) {
    display: block;
    width: 100%;
    height: auto;
  }
  :global(.generated-workspace .surface-chart text) {
    fill: #475569;
    font-family: Montserrat, sans-serif;
    font-size: 11px;
    font-weight: 600;
  }
  :global(.generated-workspace .surface-chart g[role="button"]),
  :global(.generated-workspace .surface-chart g[data-gr-click]) {
    cursor: pointer;
  }
  :global(.generated-workspace .surface-table) {
    display: block;
    width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  :global(.generated-workspace .surface-table th),
  :global(.generated-workspace .surface-table td) {
    border-bottom: 1px solid #e5e5e5;
    padding: 0.7rem 0.4rem;
    text-align: left;
  }
  :global(.generated-workspace .surface-table th) {
    color: #64748b;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  :global(.generated-workspace .generated-ui-status) {
    color: #047857;
    font-size: 0.85rem;
    font-weight: 600;
  }
  :global(.generated-workspace .generated-ui-error) {
    color: #b91c1c;
    font-size: 0.85rem;
    font-weight: 600;
  }
  @media (max-width: 639px) {
    :global(.generated-workspace .surface-item) {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.5rem;
    }
    :global(.generated-workspace button),
    :global(.generated-workspace a.surface-action) {
      width: 100%;
      justify-content: center;
      text-align: center;
    }
  }
</style>
