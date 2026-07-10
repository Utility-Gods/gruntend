<script lang="ts">
  import { onMount } from "svelte";
  import { gruntend } from "$lib/agent/client";
  import { createBrowserHandlers } from "$lib/agent/handlers";
  import TaggedHtmlSurface from "$lib/components/runtime/TaggedHtmlSurface.svelte";
  import type { GeneratedCodePlan } from "gruntend/generate";
  import type { RuntimeEvent } from "gruntend/runtime";
  import { createGeneratedUi, createHtmlTag, type GeneratedUi } from "gruntend/ui";

  type RunState = "idle" | "planning" | "running" | "done" | "error";
  type ChatMessage = {
    readonly id: string;
    readonly role: "user" | "assistant";
    readonly text: string;
    readonly tone?: "normal" | "error" | "pending";
    readonly uiComponent?: GeneratedUi;
    readonly debug?: string;
  };
  type AgentGenerator = "mock" | "pi-ai";
  type AgentPlannerInfo = {
    readonly generator: AgentGenerator;
    readonly mode?: "mock" | "openai";
    readonly model?: string;
  };
  type AgentGenerationEnvelope = AgentPlannerInfo & {
    readonly plan: GeneratedCodePlan;
  };

  const taggedHtml = createHtmlTag();
  let prompt = "";
  let state: RunState = "idle";
  let messages: ChatMessage[] = [
    {
      id: "welcome",
      role: "assistant",
      text: "Tell me what to do with menus or users. Generated UI is JS plus an html tagged template, compiled before it reaches the browser.",
    },
  ];
  let toolCallCount = 0;
  let plannerInfo: AgentPlannerInfo | undefined;

  onMount(() => {
    void loadPlannerInfo();
  });

  async function runAgent() {
    const task = prompt.trim();
    if (!task || state === "planning" || state === "running") return;

    state = "planning";
    toolCallCount = 0;
    appendMessage({ role: "user", text: task });
    const workingId = appendMessage({ role: "assistant", text: "Working on it...", tone: "pending" });
    let debugDetails = "";

    try {
      const envelope = await generatePlan(task);
      const plan = envelope.plan;
      plannerInfo = readPlannerInfo(envelope);
      debugDetails = formatDebugDetails({
        generator: envelope.generator,
        model: envelope.model,
        summary: plan.summary,
        input: plan.input,
        code: plan.code,
      });

      state = "running";
      updateMessage(workingId, { text: `${plan.summary}\nRunning app tools now...`, tone: "pending" });

      const result = await gruntend.runCodePlan(plan.code, {
        id: "sveltekit-agent-chat-plan",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers(fetch),
        ui: { html: taggedHtml },
        onEvent: recordEvent,
      });

      if (result.status === "failed") {
        throw new Error(result.error ?? "The code plan failed.");
      }

      const uiComponent = readUiComponent(result.result);
      if (!uiComponent) {
        debugDetails = formatDebugDetails({
          generator: envelope.generator,
          model: envelope.model,
          summary: plan.summary,
          input: plan.input,
          code: plan.code,
          result: result.result,
        });
        console.error("[gruntend example] generated plan did not return UI", debugDetails);
        throw new Error("The code plan did not return an html template or render function.");
      }

      state = "done";
      updateMessage(workingId, {
        text: `Generated tagged-template UI. I called ${toolCallCount} app tools.`,
        tone: "normal",
        uiComponent,
      });
    } catch (caught) {
      state = "error";
      updateMessage(workingId, {
        text: `Something failed: ${caught instanceof Error ? caught.message : String(caught)}`,
        tone: "error",
        uiComponent: errorComponent(),
        debug: [debugDetails, caught instanceof Error ? caught.stack || caught.message : String(caught)].filter(Boolean).join("\n\n"),
      });
    }
  }

  async function loadPlannerInfo() {
    try {
      const response = await fetch("/api/agent/plan");
      if (!response.ok) return;
      plannerInfo = (await response.json()) as AgentPlannerInfo;
    } catch {
      // Planner info is diagnostic only.
    }
  }

  async function generatePlan(task: string): Promise<AgentGenerationEnvelope> {
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

    return payload as AgentGenerationEnvelope;
  }

  function readPlannerInfo(envelope: AgentGenerationEnvelope): AgentPlannerInfo {
    return {
      generator: envelope.generator,
      model: envelope.model,
    };
  }

  function plannerLabel(info: AgentPlannerInfo | undefined): string {
    if (!info) return "Checking planner...";
    return info.generator === "mock" ? "Mock planner" : `LLM planner${info.model ? ` · ${info.model}` : ""}`;
  }

  function plannerBadgeClass(info: AgentPlannerInfo | undefined): string {
    if (!info) return "bg-neutral-100 text-neutral-600";
    return info.generator === "mock" ? "bg-neutral-100 text-neutral-700" : "bg-green-100 text-green-800";
  }

  function formatDebugDetails(details: Record<string, unknown>): string {
    return JSON.stringify(details, null, 2);
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

  function readUiComponent(result: unknown): GeneratedUi | undefined {
    const ui = createGeneratedUi(result);
    return ui.status === "ok" ? ui.value : undefined;
  }

  function errorComponent(): GeneratedUi {
    return createGeneratedUi(taggedHtml`<section class="surface-card"><p class="surface-text">The error is shown in this chat message. Try another task or adjust the prompt.</p></section>`).unwrap();
  }

  function reportUiError(error: unknown) {
    console.error("[gruntend example] tagged UI failed", error);
  }
</script>

<section class="mx-auto max-w-3xl space-y-6" aria-label="Agent chat">
  <header class="space-y-2">
    <p class="text-xs font-medium uppercase tracking-[0.12em] text-orange-600">Agent chat</p>
    <h1 class="text-3xl font-medium tracking-tight text-neutral-950">Ask the app to do something</h1>
    <div class="flex flex-wrap items-center gap-3">
      <p class="max-w-2xl text-base leading-7 text-neutral-600">
        Generated UI uses native JavaScript plus the Gruntend <code>html</code> tag.
      </p>
      <span class={`inline-flex px-2.5 py-1 text-xs font-semibold ${plannerBadgeClass(plannerInfo)}`}>
        {plannerLabel(plannerInfo)}
      </span>
    </div>
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
          {#if message.uiComponent}
            <div class="mt-3">
              <TaggedHtmlSurface ui={message.uiComponent} onError={reportUiError} />
            </div>
          {/if}
          {#if message.debug}
            <details class="mt-3 whitespace-pre-wrap bg-black/5 p-3 text-xs leading-5 text-neutral-700">
              <summary class="cursor-pointer font-semibold">Debug details</summary>
              {message.debug}
            </details>
          {/if}
        </div>
      </article>
    {/each}
  </div>

  <form
    class="space-y-3 bg-white p-4 shadow-sm"
    onsubmit={(event) => {
      event.preventDefault();
      runAgent();
    }}
  >
    <textarea
      bind:value={prompt}
      rows="3"
      class="block w-full resize-y bg-transparent text-base leading-7 text-neutral-950 outline-none placeholder:text-neutral-400"
      placeholder="Ask about menus or users"
    ></textarea>

    <div class="flex justify-end border-t border-neutral-100 pt-3">
      <button
        class="bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={state === "planning" || state === "running" || prompt.trim().length === 0}
      >
        {state === "planning" || state === "running" ? "Working..." : "Send"}
      </button>
    </div>
  </form>
</section>
