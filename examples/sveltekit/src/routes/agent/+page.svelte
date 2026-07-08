<script lang="ts">
  import { gruntend } from "$lib/agent/client";
  import { createBrowserHandlers } from "$lib/agent/handlers";
  import { createHypermediaActionPlan } from "$lib/agent/hypermedia-action-plan";
  import HtmlSurface from "$lib/components/hypermedia/HtmlSurface.svelte";
  import type { GeneratedCodePlan } from "gruntend/generate";
  import type { HtmlSurfaceActionSubmission } from "gruntend/hypermedia";
  import type { RuntimeEvent } from "gruntend/runtime";

  type RunState = "idle" | "planning" | "running" | "done" | "error";
  type ChatMessage = {
    readonly id: string;
    readonly role: "user" | "assistant";
    readonly text: string;
    readonly tone?: "normal" | "error" | "pending";
    readonly surfaceHtml?: string;
  };
  type AgentGenerationEnvelope = {
    readonly generator: "mock" | "pi-ai";
    readonly model?: string;
    readonly plan: GeneratedCodePlan;
  };
  type RuntimeHtmlResult = {
    readonly html?: unknown;
    readonly action?: unknown;
  };

  const examples = [
    'Copy "Dinner Menu" to "Lunch Menu" except burgers',
    'Add vegetarian items to "Brunch Menu"',
    'Create user "Sam Rivera" as manager',
    "Summarize the restaurant data",
  ];

  let prompt = examples[0];
  let state: RunState = "idle";
  let messages: ChatMessage[] = [
    {
      id: "welcome",
      role: "assistant",
      text: "Tell me what to do with menus or users. This demo skips OpenAI and uses a deterministic planner, but the app tools still run through Gruntend.",
      surfaceHtml: quickActionsSurface(),
    },
  ];
  let toolCallCount = 0;

  async function runAgent() {
    const task = prompt.trim();
    if (!task || state === "planning" || state === "running") return;

    state = "planning";
    toolCallCount = 0;
    appendMessage({ role: "user", text: task });
    const workingId = appendMessage({ role: "assistant", text: "Working on it...", tone: "pending" });

    try {
      const plan = await generatePlan(task);

      state = "running";
      updateMessage(workingId, { text: `${plan.summary}\nRunning app tools now...`, tone: "pending" });

      const result = await gruntend.runCodePlan(plan.code, {
        id: "sveltekit-agent-chat-plan",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers(fetch),
        onEvent: recordEvent,
      });

      if (result.status === "failed") {
        throw new Error(result.error ?? "The code plan failed.");
      }

      state = "done";
      updateMessage(workingId, {
        text: resultSummary(result.result),
        tone: "normal",
        surfaceHtml: readSurfaceHtml(result.result) ?? doneSurface(),
      });
    } catch (caught) {
      state = "error";
      updateMessage(workingId, {
        text: `Something failed: ${caught instanceof Error ? caught.message : String(caught)}`,
        tone: "error",
        surfaceHtml: errorSurface(),
      });
    }
  }

  async function generatePlan(task: string): Promise<GeneratedCodePlan> {
    const response = await fetch("/api/agent/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: task }),
    });
    const payload = (await response.json()) as AgentGenerationEnvelope | { readonly message?: string };

    if (!response.ok) {
      throw new Error(
        "message" in payload && typeof payload.message === "string" && payload.message.length > 0
          ? payload.message
          : "Planning failed.",
      );
    }

    return (payload as AgentGenerationEnvelope).plan;
  }

  function recordEvent(event: RuntimeEvent) {
    if (event.type === "tool.started") {
      toolCallCount = toolCallCount + 1;
    }
  }

  function appendMessage(message: Omit<ChatMessage, "id">): string {
    const id = `m_${Date.now()}_${messages.length}`;
    messages = [...messages, { id, ...message }];
    return id;
  }

  function updateMessage(id: string, update: Partial<Omit<ChatMessage, "id" | "role">>) {
    messages = messages.map((message) => (message.id === id ? { ...message, ...update } : message));
  }

  function submitHypermediaAction(actionId: string, _submission: HtmlSurfaceActionSubmission) {
    if (actionId === "/examples/copy-menu") {
      prompt = examples[0];
      return;
    }

    if (actionId === "/examples/add-vegetarian-items") {
      prompt = examples[1];
      return;
    }

    if (actionId === "/menus") {
      window.location.href = "/menus";
      return;
    }

    if (actionId === "/users") {
      window.location.href = "/users";
      return;
    }

    void runHypermediaActionPlan(actionId);
  }

  async function runHypermediaActionPlan(actionId: string) {
    const plan = createHypermediaActionPlan(actionId);
    if (!plan) {
      appendMessage({ role: "assistant", text: `No code plan is registered for ${actionId}.`, tone: "error" });
      return;
    }

    toolCallCount = 0;
    const workingId = appendMessage({ role: "assistant", text: `${plan.summary}\nRunning app tools now...`, tone: "pending" });

    try {
      const result = await gruntend.runCodePlan(plan.code, {
        id: "sveltekit-agent-hypermedia-action",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers(fetch),
        onEvent: recordEvent,
      });

      if (result.status === "failed") {
        throw new Error(result.error ?? "The hypermedia action code plan failed.");
      }

      updateMessage(workingId, {
        text: resultSummary(result.result),
        tone: "normal",
        surfaceHtml: readSurfaceHtml(result.result) ?? doneSurface(),
      });
    } catch (caught) {
      updateMessage(workingId, {
        text: `Something failed: ${caught instanceof Error ? caught.message : String(caught)}`,
        tone: "error",
        surfaceHtml: errorSurface(),
      });
    }
  }

  function resultSummary(result: unknown): string {
    const action = readRuntimeAction(result);
    return `Done. I called ${toolCallCount} app tools${action ? ` for ${action}` : ""}.`;
  }

  function readRuntimeAction(result: unknown): string | undefined {
    if (!isRuntimeHtmlResult(result) || typeof result.action !== "string") return undefined;
    return result.action;
  }

  function readSurfaceHtml(result: unknown): string | undefined {
    if (!isRuntimeHtmlResult(result) || typeof result.html !== "string" || result.html.trim().length === 0) {
      return undefined;
    }

    return result.html;
  }

  function isRuntimeHtmlResult(result: unknown): result is RuntimeHtmlResult {
    return typeof result === "object" && result !== null;
  }

  function quickActionsSurface(): string {
    return `<div class="surface-card">
  <div class="surface-actions">
    <button type="button" gr-href="/examples/copy-menu">Use copy-menu task</button>
    <button type="button" gr-href="/examples/add-vegetarian-items">Use vegetarian task</button>
  </div>
</div>`;
  }

  function doneSurface(): string {
    return `<div class="surface-card">
  <p class="surface-text">The plan completed, but it did not return a hypermedia HTML surface.</p>
  <div class="surface-actions">
    <button type="button" gr-href="/menus">Open menus</button>
    <button type="button" gr-href="/users">Open users</button>
  </div>
</div>`;
  }

  function errorSurface(): string {
    return `<div class="surface-card">
  <p class="surface-text">The error is shown in this chat message. Try another task or adjust the prompt.</p>
</div>`;
  }
</script>

<section class="mx-auto max-w-3xl space-y-6" aria-label="Agent chat">
  <header class="space-y-2">
    <p class="text-xs font-medium uppercase tracking-[0.12em] text-orange-600">Agent chat</p>
    <h1 class="text-3xl font-medium tracking-tight text-neutral-950">Ask the app to do something</h1>
    <p class="max-w-2xl text-base leading-7 text-neutral-600">
      Mock planning is deterministic. The generated code still runs through Gruntend tools and app handlers.
    </p>
  </header>

  <div class="space-y-4" aria-live="polite">
    {#each messages as message}
      <article class={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        <div
          class={`max-w-[88%] px-0 py-1 text-[15px] leading-7 ${
            message.role === "user"
              ? "bg-orange-600 px-4 py-3 text-white"
              : message.tone === "error"
                ? "bg-red-50 px-4 py-3 text-red-700"
                : message.tone === "pending"
                  ? "bg-orange-50 px-4 py-3 text-neutral-800"
                  : "text-neutral-800"
          }`}
        >
          {#each message.text.split("\n") as line}
            <p class="text-inherit">{line}</p>
          {/each}
          {#if message.surfaceHtml}
            <div class="mt-3">
              <HtmlSurface html={message.surfaceHtml} submitAction={submitHypermediaAction} />
            </div>
          {/if}
        </div>
      </article>
    {/each}
  </div>

  <form class="space-y-3 bg-white p-4 shadow-sm" on:submit|preventDefault={runAgent}>
    <textarea
      bind:value={prompt}
      rows="3"
      class="block w-full resize-y bg-transparent text-base leading-7 text-neutral-950 outline-none placeholder:text-neutral-400"
      placeholder="Ask about menus or users"
    ></textarea>

    <div class="flex flex-col gap-3 border-t border-neutral-100 pt-3 md:flex-row md:items-end md:justify-between">
      <div class="flex flex-wrap gap-2" aria-label="Example tasks">
        {#each examples as example}
          <button
            type="button"
            class="bg-neutral-100 px-3 py-2 text-sm text-neutral-700 hover:bg-orange-50 hover:text-orange-700"
            on:click={() => (prompt = example)}
          >
            {example}
          </button>
        {/each}
      </div>

      <button
        class="bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={state === "planning" || state === "running"}
      >
        {state === "planning" || state === "running" ? "Working..." : "Send"}
      </button>
    </div>
  </form>
</section>
