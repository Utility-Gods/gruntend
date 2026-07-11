<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { Copy, Loader, Salad, Tags, TrendingUp } from "lucide-svelte";
  import { gruntend } from "$lib/agent/client";
  import { createBrowserHandlers } from "$lib/agent/handlers";
  import { generateAgentPlan } from "$lib/remote/agent.remote";
  import { getMenusWithItems, getUsers } from "$lib/remote/example.remote";
  import type { GeneratedCodePlan } from "gruntend/generate";
  import type { RuntimeEvent } from "gruntend/runtime";
  import {
    createGeneratedUi,
    createHtmlTag,
    type GeneratedUi as GeneratedUiModel,
  } from "gruntend/ui";
  import GeneratedUi from "gruntend/ui/svelte";

  type RunState = "idle" | "planning" | "running" | "done" | "error";
  type AgentGenerationEnvelope = {
    readonly generator: "mock" | "pi-ai";
    readonly model?: string;
    readonly plan: GeneratedCodePlan;
  };

  const suggestions = [
    {
      kind: "price",
      prompt:
        "Show every item under $10 and preview a 20% price increase for each item",
    },
    {
      kind: "menu",
      prompt: "Build a Vegetarian Specials menu from vegetarian items",
    },
    {
      kind: "tags",
      prompt: "Add a seasonal tag to drinks under $7",
    },
    {
      kind: "copy",
      prompt: "Copy popular Dinner items into the Brunch menu",
    },
  ] as const;

  const taggedHtml = createHtmlTag();
  const menusResponse = $derived(getMenusWithItems().current);
  const usersResponse = $derived(getUsers().current);
  const menuCount = $derived(menusResponse?.menus.length ?? 0);
  const itemCount = $derived(
    menusResponse?.menus.reduce(
      (total, menu) => total + menu.items.length,
      0,
    ) ?? 0,
  );
  const teamCount = $derived(usersResponse?.users.length ?? 0);

  let prompt = $state("");
  let state = $state<RunState>("idle");
  let resultUi = $state<GeneratedUiModel>();
  let resultTitle = $state("");
  let errorMessage = $state("");
  let debugDetails = $state("");
  let toolCallCount = $state(0);
  let notice = $state("");
  let promptInput: HTMLTextAreaElement;

  function chooseSuggestion(suggestion: string) {
    prompt = suggestion;
    notice = "";
    promptInput.focus();
  }

  function submitTask() {
    const task = prompt.trim();
    if (!task) {
      notice = "Describe an operation first, or choose one of the suggestions.";
      return;
    }
    notice = "";
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
      const result = await gruntend.runCodePlan(plan.code, {
        id: "restaurant-dashboard-plan",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers(),
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
    if (event.type === "tool.started") toolCallCount += 1;
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
    <div class="flex flex-col gap-5 px-6 py-6 md:px-8">
      <div
        class="flex flex-col justify-between gap-5 md:flex-row md:items-start"
      >
        <div class="max-w-2xl">
          <p
            class="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600"
          >
            Restaurant operations
          </p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            What needs to happen today?
          </h1>
          <p class="mt-2 text-sm leading-6 text-neutral-600">
            Describe the change you need.
          </p>
        </div>
        <dl
          class="flex divide-x divide-neutral-200 border border-neutral-200 bg-[#faf9f6]"
        >
          <div class="min-w-24 px-4 py-2.5">
            <dt class="text-[11px] text-neutral-500">Menus</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {menuCount}
            </dd>
          </div>
          <div class="min-w-24 px-4 py-2.5">
            <dt class="text-[11px] text-neutral-500">Items</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {itemCount}
            </dd>
          </div>
          <div class="min-w-24 px-4 py-2.5">
            <dt class="text-[11px] text-neutral-500">Staff</dt>
            <dd class="mt-0.5 text-lg font-semibold text-slate-950">
              {teamCount}
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
        <div class="flex flex-col gap-2 sm:flex-row">
          <textarea
            bind:this={promptInput}
            bind:value={prompt}
            rows="1"
            class="min-h-12 flex-1 resize-none border border-neutral-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-950 outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            placeholder="Move selected dinner items to a new seasonal menu..."
          ></textarea>
          <button
            type="submit"
            class="h-12 bg-primary-600 px-5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
            disabled={state === "planning" || state === "running"}
          >
            {state === "planning"
              ? "Working..."
              : state === "running"
                ? "Preparing..."
                : "Run"}
          </button>
        </div>
        <div class="mt-3 grid gap-2 lg:grid-cols-2">
          {#each suggestions as suggestion}
            <button
              type="button"
              class="group flex w-full items-center gap-3 border border-neutral-200 bg-[#faf9f6] px-3 py-3 text-left transition hover:border-primary-600 hover:bg-white"
              onclick={() => chooseSuggestion(suggestion.prompt)}
            >
              <span class="text-primary-600">
                {#if suggestion.kind === "price"}
                  <TrendingUp size={19} strokeWidth={2.1} />
                {:else if suggestion.kind === "menu"}
                  <Salad size={19} strokeWidth={2.1} />
                {:else if suggestion.kind === "tags"}
                  <Tags size={19} strokeWidth={2.1} />
                {:else}
                  <Copy size={19} strokeWidth={2.1} />
                {/if}
              </span>
              <strong
                class="min-w-0 flex-1 text-xs font-semibold leading-5 text-slate-900 group-hover:text-primary-600"
              >
                {suggestion.prompt}
              </strong>
              <span
                class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 group-hover:text-primary-600"
                >Review</span
              >
            </button>
          {/each}
        </div>
      </form>
    </div>

    {#if state !== "idle"}
      <div class="border-t border-neutral-200 bg-white" aria-live="polite">
        {#if state === "done" || state === "error"}
          <header
            class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-[#faf9f6] px-6 py-3 md:px-8"
          >
            <h2 class="text-base font-semibold text-slate-950">
              {resultTitle}
            </h2>
            {#if state === "done"}
              <span
                class="bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
              >
                Ready · {toolCallCount} operation{toolCallCount === 1
                  ? ""
                  : "s"}
              </span>
            {/if}
          </header>
        {/if}

        <div class="p-5 md:p-6">
          {#if state === "planning" || state === "running"}
            <div class="mx-auto flex max-w-2xl items-start gap-4 py-5">
              <Loader
                class="mt-0.5 shrink-0 animate-spin text-primary-600"
                size={24}
                strokeWidth={2.3}
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-4">
                  <p class="text-sm font-semibold text-slate-900">
                    {state === "planning"
                      ? "Working on your request"
                      : "Preparing the result"}
                  </p>
                  <span
                    class="text-xs font-medium tabular-nums text-neutral-500"
                  >
                    {state === "planning" ? "35%" : "75%"}
                  </span>
                </div>
                <div
                  class="mt-2.5 h-2 overflow-hidden rounded-full bg-neutral-100"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={state === "planning" ? 35 : 75}
                >
                  <div
                    class={`h-full rounded-full bg-primary-600 transition-[width] duration-700 ease-out ${state === "planning" ? "w-[35%]" : "w-3/4"}`}
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
                onError={(error) => console.error("Generated UI failed", error)}
              />
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </section>
</div>

{#if notice}
  <div
    class="fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,34rem)] -translate-x-1/2 items-center justify-between gap-4 border border-primary-200 bg-white px-4 py-3 shadow-lg"
    role="status"
  >
    <p class="text-sm font-medium text-slate-800">{notice}</p>
    <button
      type="button"
      class="shrink-0 text-xs font-semibold text-primary-700 hover:text-primary-900"
      onclick={() => (notice = "")}>Dismiss</button
    >
  </div>
{/if}

<style>
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
  :global(.generated-workspace .surface-table) {
    width: 100%;
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
</style>
