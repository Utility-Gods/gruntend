<script lang="ts">
  import { gruntend } from "$lib/agent/client";
  import { createBrowserHandlers } from "$lib/agent/handlers";
  import type { Menu, MenuItem, User } from "$lib/types";
  import type { GeneratedCodePlan } from "gruntend/generate";
  import type { RuntimeEvent } from "gruntend/runtime";

  type RunState = "idle" | "planning" | "running" | "done" | "error";
  type AgentGenerationEnvelope = {
    readonly generator: "pi-ai";
    readonly model?: string;
    readonly plan: GeneratedCodePlan;
    readonly stopReason?: string;
    readonly usage?: unknown;
    readonly responseId?: string;
  };
  type GenerationMeta = {
    readonly generator: "pi-ai";
    readonly model?: string;
    readonly stopReason?: string;
    readonly usage?: unknown;
    readonly responseId?: string;
  };
  type ToolCallView = {
    readonly callId: string;
    readonly tool: string;
    readonly status: "running" | "retrying" | "done" | "failed";
    readonly input?: unknown;
    readonly output?: unknown;
    readonly error?: string;
  };
  type AppSnapshot = {
    readonly menus: Menu[];
    readonly items: MenuItem[];
    readonly users: User[];
  };
  type AppStateDiff = {
    readonly menus: Menu[];
    readonly items: MenuItem[];
    readonly users: User[];
  };

  const examples = [
    'Copy "Dinner Menu" to "Lunch Menu" except burgers',
    'Add vegetarian items to "Brunch Menu"',
    'Create user "Sam Rivera" as manager',
    "Summarize the restaurant data",
  ];

  let prompt = examples[0];
  let activeTask = "";
  let runStartedAt = "";
  let state: RunState = "idle";
  let message = "";
  let summary = "";
  let code = "";
  let planInput = "";
  let generationMeta: GenerationMeta | null = null;
  let resultJson = "";
  let eventLog: string[] = [];
  let toolCalls: ToolCallView[] = [];
  let beforeSnapshot: AppSnapshot | null = null;
  let afterSnapshot: AppSnapshot | null = null;
  let appDiff: AppStateDiff | null = null;

  async function runAgent() {
    const task = prompt.trim();
    if (!task) {
      activeTask = "";
      message = "Enter a task before running the agent.";
      state = "error";
      return;
    }

    activeTask = task;
    runStartedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    state = "planning";
    message = "Calling OpenAI to produce a Gruntend code plan.";
    summary = "";
    code = "";
    planInput = "";
    generationMeta = null;
    resultJson = "";
    eventLog = [];
    toolCalls = [];
    beforeSnapshot = null;
    afterSnapshot = null;
    appDiff = null;

    try {
      beforeSnapshot = await loadAppSnapshot();
      const plan = await generateWithLlm(task);
      summary = plan.summary;
      code = plan.code;
      planInput = JSON.stringify(plan.input, null, 2);
      state = "running";
      message = "Executing the generated plan through registered app tools.";

      const result = await gruntend.runCodePlan(plan.code, {
        id: "sveltekit-agent-plan",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers(fetch),
        onEvent: recordEvent,
      });

      resultJson = JSON.stringify(result, null, 2);
      afterSnapshot = await loadAppSnapshot();
      appDiff = diffSnapshots(beforeSnapshot, afterSnapshot);

      if (result.status === "failed") {
        throw new Error(result.error ?? "The code plan failed.");
      }

      message = proofCount(appDiff) > 0
        ? "Agent plan completed and changed the app state below."
        : "Agent plan completed. No new app records were created.";
      state = "done";
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
      state = "error";
    }
  }

  async function generateWithLlm(task: string): Promise<GeneratedCodePlan> {
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
          : "Code plan generation failed.",
      );
    }

    const envelope = payload as AgentGenerationEnvelope;
    generationMeta = {
      generator: envelope.generator,
      model: envelope.model,
      stopReason: envelope.stopReason,
      usage: envelope.usage,
      responseId: envelope.responseId,
    };
    return envelope.plan;
  }

  function recordEvent(event: RuntimeEvent) {
    if (event.type === "plan.started") {
      eventLog = [...eventLog, "Plan execution started"];
      return;
    }

    if (event.type === "plan.completed") {
      eventLog = [...eventLog, "Plan execution completed"];
      return;
    }

    if (event.type === "plan.failed") {
      eventLog = [...eventLog, `Plan failed: ${event.error}`];
      return;
    }

    if (event.type === "tool.started") {
      upsertToolCall({ callId: event.callId, tool: event.tool, status: "running", input: event.input });
      eventLog = [...eventLog, `${event.callId}: started ${event.tool}`];
      return;
    }

    if (event.type === "tool.retrying") {
      upsertToolCall({ callId: event.callId, tool: event.tool, status: "retrying", error: event.error.message });
      eventLog = [...eventLog, `${event.callId}: retrying ${event.tool}`];
      return;
    }

    if (event.type === "tool.completed") {
      upsertToolCall({ callId: event.callId, tool: event.tool, status: "done", output: event.output.data });
      eventLog = [...eventLog, `${event.callId}: completed ${event.tool}`];
      return;
    }

    if (event.type === "tool.failed") {
      upsertToolCall({ callId: event.callId, tool: event.tool, status: "failed", error: event.error.message });
      eventLog = [...eventLog, `${event.callId}: failed ${event.error.message}`];
    }
  }

  function upsertToolCall(next: ToolCallView) {
    const index = toolCalls.findIndex((call) => call.callId === next.callId);
    toolCalls =
      index === -1
        ? [...toolCalls, next]
        : toolCalls.map((call, currentIndex) => (currentIndex === index ? { ...call, ...next } : call));
  }

  async function loadAppSnapshot(): Promise<AppSnapshot> {
    const [menusPayload, usersPayload] = await Promise.all([
      fetch("/api/menus").then((response) => response.json()) as Promise<{ readonly menus: Menu[] }>,
      fetch("/api/users").then((response) => response.json()) as Promise<{ readonly users: User[] }>,
    ]);
    const itemPayloads = await Promise.all(
      menusPayload.menus.map((menu) =>
        fetch(`/api/menus/${menu.menuId}/items`).then((response) => response.json()) as Promise<{ readonly items: MenuItem[] }>,
      ),
    );

    return {
      menus: menusPayload.menus,
      users: usersPayload.users,
      items: itemPayloads.flatMap((payload) => payload.items),
    };
  }

  function diffSnapshots(before: AppSnapshot, after: AppSnapshot): AppStateDiff {
    const beforeMenuIds = new Set(before.menus.map((menu) => menu.menuId));
    const beforeItemIds = new Set(before.items.map((item) => item.itemId));
    const beforeUserIds = new Set(before.users.map((user) => user.userId));

    return {
      menus: after.menus.filter((menu) => !beforeMenuIds.has(menu.menuId)),
      items: after.items.filter((item) => !beforeItemIds.has(item.itemId)),
      users: after.users.filter((user) => !beforeUserIds.has(user.userId)),
    };
  }

  function proofCount(diff: AppStateDiff | null): number {
    return diff ? diff.menus.length + diff.items.length + diff.users.length : 0;
  }

  function stateLabel() {
    if (state === "idle") return "Ready";
    if (state === "planning") return "Generating plan";
    if (state === "running") return "Running tools";
    if (state === "done") return "Completed";
    return "Needs review";
  }
</script>

<section class="page-heading agent-heading">
  <p class="eyebrow">Agent</p>
  <h1>Run a task and inspect the proof.</h1>
  <p>
    OpenAI returns a code plan. Gruntend executes that plan only through the app's registered tools. The result, code,
    and tool calls stay visible so you can verify what happened.
  </p>
</section>

<section class="panel composer">
  <div>
    <label for="prompt">Task</label>
    <textarea id="prompt" bind:value={prompt} rows="3" placeholder="Tell the agent what to do with menus or users"></textarea>
  </div>

  <div class="examples" aria-label="Example tasks">
    {#each examples as example}
      <button type="button" on:click={() => (prompt = example)}>{example}</button>
    {/each}
  </div>

  <button class="button" type="button" disabled={state === "planning" || state === "running"} on:click={runAgent}>
    {state === "planning" ? "Calling OpenAI..." : state === "running" ? "Running tools..." : "Run agent"}
  </button>
</section>

<section class="run-overview">
  <article class="panel run-card" class:error={state === "error"}>
    <div>
      <p class="eyebrow">Current run</p>
      <h2>{activeTask || "No task has been run yet"}</h2>
      <p>{summary || message || "Run a task to see the generated plan, execution trace, and app result."}</p>
    </div>
    <dl>
      <div><dt>Status</dt><dd>{stateLabel()}</dd></div>
      <div><dt>Started</dt><dd>{runStartedAt || "—"}</dd></div>
      <div><dt>Tools</dt><dd>{toolCalls.length}</dd></div>
    </dl>
  </article>

  <article class="panel compact-timeline" aria-label="Run progress">
    <div class:done={!!activeTask} class:active={state === "planning"}>
      <span>1</span><strong>Task</strong><small>{activeTask ? "Locked" : "Waiting"}</small>
    </div>
    <div class:done={!!code} class:active={state === "planning"}>
      <span>2</span><strong>Plan</strong><small>{generationMeta?.model ?? "OpenAI"}</small>
    </div>
    <div class:done={toolCalls.length > 0} class:active={state === "running"}>
      <span>3</span><strong>Tools</strong><small>{toolCalls.length} calls</small>
    </div>
    <div class:done={state === "done"} class:error={state === "error"}>
      <span>4</span><strong>Result</strong><small>{stateLabel()}</small>
    </div>
  </article>
</section>

<section class="evidence-grid" aria-label="Run evidence">
  <article class="panel evidence proof-panel" class:error={state === "error"}>
    <div class="evidence-heading">
      <div>
        <p class="eyebrow">Proof in app state</p>
        <h2>
          {state === "done"
            ? proofCount(appDiff) > 0
              ? `${proofCount(appDiff)} new records created`
              : "Execution finished with no new records"
            : state === "error"
              ? "Run needs review"
              : "Waiting for app changes"}
        </h2>
      </div>
      {#if state !== "idle"}<span class={`status-pill ${state}`}>{stateLabel()}</span>{/if}
    </div>

    {#if appDiff && proofCount(appDiff) > 0}
      <div class="diff-summary">
        <div><strong>{appDiff.menus.length}</strong><span>menus added</span></div>
        <div><strong>{appDiff.items.length}</strong><span>items added</span></div>
        <div><strong>{appDiff.users.length}</strong><span>users added</span></div>
      </div>

      <div class="record-list">
        {#each appDiff.menus as menu}
          <article class="record-card">
            <span>New menu</span>
            <strong>{menu.name}</strong>
            <small>{menu.menuId} · {menu.description}</small>
          </article>
        {/each}

        {#each appDiff.items as item}
          <article class="record-card">
            <span>New item</span>
            <strong>{item.name}</strong>
            <small>{item.menuId} · ${item.price.toFixed(2)} · {item.tags.join(", ") || "no tags"}</small>
          </article>
        {/each}

        {#each appDiff.users as user}
          <article class="record-card">
            <span>New user</span>
            <strong>{user.name}</strong>
            <small>{user.userId} · {user.role}</small>
          </article>
        {/each}
      </div>
    {:else if state === "done"}
      <div class="empty-proof">The plan ran, but the app data snapshot did not gain new menus, items, or users.</div>
    {:else if message}
      <div class="empty-proof" class:error={state === "error"}>{message}</div>
    {:else}
      <div class="empty-proof">Run a task. This panel will compare app data before and after execution.</div>
    {/if}

    {#if state === "done"}
      <div class="actions">
        <a class="button" href="/menus">Open changed menus</a>
        <a class="secondary" href="/users">Open users</a>
      </div>
    {/if}
  </article>

  <article class="panel evidence tool-panel">
    <div class="evidence-heading">
      <div>
        <p class="eyebrow">Runtime evidence</p>
        <h2>{toolCalls.length > 0 ? `${toolCalls.length} app tool calls` : "No tools called yet"}</h2>
      </div>
      {#if generationMeta}<span class="status-pill done">{generationMeta.model}</span>{/if}
    </div>

    {#if toolCalls.length > 0}
      <div class="tool-proof large">
        {#each toolCalls as call}
          <div class={`tool-row ${call.status}`}>
            <code>{call.callId}</code>
            <strong>{call.tool}</strong>
            <span>{call.status}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-proof">Tool calls will appear here as Gruntend invokes app-owned handlers.</div>
    {/if}
  </article>
</section>

{#if generationMeta || code || planInput || resultJson || eventLog.length > 0}
  <section class="details-grid">
    {#if code}
      <article class="panel details-panel">
        <p class="eyebrow">Generated code, not proof</p>
        <pre>{code}</pre>
      </article>
    {/if}

    {#if resultJson}
      <article class="panel details-panel">
        <p class="eyebrow">Runtime return value</p>
        <pre>{resultJson}</pre>
      </article>
    {/if}

    {#if generationMeta}
      <article class="panel details-panel">
        <p class="eyebrow">LLM metadata</p>
        <dl class="meta-grid">
          <div><dt>Model</dt><dd>{generationMeta.model}</dd></div>
          <div><dt>Stop reason</dt><dd>{generationMeta.stopReason}</dd></div>
          <div><dt>Response id</dt><dd>{generationMeta.responseId ?? "—"}</dd></div>
        </dl>
      </article>
    {/if}

    {#if planInput}
      <article class="panel details-panel">
        <p class="eyebrow">Runtime input</p>
        <pre>{planInput}</pre>
      </article>
    {/if}

    {#if eventLog.length > 0}
      <article class="panel details-panel">
        <p class="eyebrow">Lifecycle</p>
        <ul>
          {#each eventLog as event}
            <li>{event}</li>
          {/each}
        </ul>
      </article>
    {/if}
  </section>
{/if}

<style>
  .agent-heading {
    max-width: 48rem;
    margin-bottom: 1.25rem;
  }

  .agent-heading h1 {
    max-width: 42rem;
    font-size: clamp(2rem, 1.4vw + 1.25rem, 3.2rem);
    line-height: 1.08;
  }

  .agent-heading p:not(.eyebrow) {
    max-width: 43rem;
    font-size: 1rem;
    line-height: 1.62;
  }

  .composer {
    display: grid;
    gap: 0.9rem;
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.45rem;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-weight: 820;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 6rem;
    resize: vertical;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--ps-control-radius);
    background: #fff;
    color: var(--color-text-primary);
    padding: 0.8rem 0.9rem;
    line-height: 1.6;
    outline: none;
  }

  textarea:focus {
    border-color: var(--color-primary-300);
    box-shadow: 0 0 0 4px rgb(249 115 22 / 10%);
  }

  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .examples button {
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    padding: 0.42rem 0.7rem;
    line-height: 1.25;
    cursor: pointer;
  }

  .run-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .run-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .run-card h2 {
    margin-bottom: 0.35rem;
    font-size: 1.28rem;
    line-height: 1.25;
  }

  .run-card dl {
    display: grid;
    min-width: 13rem;
    gap: 0.5rem;
  }

  .run-card dl div,
  .meta-grid div {
    border-radius: 0.75rem;
    background: var(--color-primary-50);
    padding: 0.7rem 0.8rem;
  }

  dt {
    color: var(--color-text-tertiary);
    font-size: 0.72rem;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  dd {
    margin-top: 0.2rem;
    color: var(--color-text-primary);
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .compact-timeline {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .compact-timeline div {
    border-radius: 0.75rem;
    background: var(--color-neutral-50);
    padding: 0.75rem;
  }

  .compact-timeline div.done,
  .compact-timeline div.active {
    background: var(--color-primary-50);
  }

  .compact-timeline div.error {
    background: var(--color-error-bg);
  }

  .compact-timeline span {
    display: inline-grid;
    width: 1.5rem;
    height: 1.5rem;
    place-items: center;
    border-radius: 999px;
    background: var(--color-primary-600);
    color: white;
    font-size: 0.78rem;
    font-weight: 900;
  }

  .compact-timeline strong,
  .compact-timeline small {
    display: block;
  }

  .compact-timeline strong {
    margin-top: 0.45rem;
    color: var(--color-text-primary);
  }

  .compact-timeline small {
    color: var(--color-text-tertiary);
    line-height: 1.4;
  }

  .evidence-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 1rem;
  }

  .evidence {
    display: flex;
    min-height: 26rem;
    flex-direction: column;
    gap: 1rem;
  }

  .evidence-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .evidence-heading h2 {
    font-size: 1.22rem;
    line-height: 1.25;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-700);
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
  }

  .status-pill.done,
  .status-pill.running {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .status-pill.error {
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  pre {
    overflow: auto;
    max-height: 22rem;
    margin: 0;
    border-radius: 0.75rem;
    background: var(--color-secondary-900);
    color: #fed7aa;
    padding: 1rem;
    line-height: 1.62;
  }

  .empty-proof {
    border-radius: 0.75rem;
    background: var(--color-neutral-50);
    color: var(--color-text-secondary);
    padding: 1rem;
    line-height: 1.6;
  }

  .diff-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .diff-summary div {
    border-radius: 0.85rem;
    background: var(--color-primary-50);
    padding: 0.9rem;
  }

  .diff-summary strong,
  .diff-summary span {
    display: block;
  }

  .diff-summary strong {
    color: var(--color-primary-700);
    font-size: 1.75rem;
    line-height: 1;
  }

  .diff-summary span {
    margin-top: 0.25rem;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 760;
  }

  .record-list {
    display: grid;
    gap: 0.65rem;
  }

  .record-card {
    border-radius: 0.85rem;
    background: var(--color-neutral-50);
    padding: 0.85rem 0.95rem;
  }

  .record-card span,
  .record-card small {
    display: block;
  }

  .record-card span {
    color: var(--color-primary-700);
    font-size: 0.74rem;
    font-weight: 860;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .record-card strong {
    display: block;
    margin-top: 0.18rem;
    color: var(--color-text-primary);
    font-size: 1rem;
  }

  .record-card small {
    margin-top: 0.18rem;
    color: var(--color-text-tertiary);
    line-height: 1.45;
  }

  .empty-proof.error,
  .panel.error {
    border-color: var(--color-error-border);
  }

  .tool-proof {
    display: grid;
    gap: 0.45rem;
  }

  .tool-proof.large {
    gap: 0.6rem;
  }

  .tool-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    border-radius: 0.65rem;
    background: var(--color-neutral-50);
    padding: 0.6rem 0.7rem;
  }

  .tool-row.done {
    background: var(--color-primary-50);
  }

  .tool-row.failed {
    background: var(--color-error-bg);
  }

  .tool-row strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-row span {
    color: var(--color-text-tertiary);
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  code {
    color: var(--color-primary-700);
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: auto;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .details-panel {
    display: grid;
    gap: 0.8rem;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  ul {
    margin: 0;
    padding-left: 1.2rem;
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  @media (max-width: 1180px) {
    .run-overview,
    .evidence-grid {
      grid-template-columns: 1fr;
    }

    .run-card {
      flex-direction: column;
    }

    .run-card dl {
      min-width: 0;
      width: 100%;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .compact-timeline,
    .run-card dl,
    .diff-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
