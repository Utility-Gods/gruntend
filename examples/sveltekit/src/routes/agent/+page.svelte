<script lang="ts">
  import { gruntend } from "$lib/agent/client";
  import { createBrowserHandlers } from "$lib/agent/handlers";
  import { generateMockCodePlan } from "$lib/agent/mock-llm";
  import type { RuntimeEvent } from "gruntend/runtime";

  type RunState = "idle" | "planning" | "running" | "done" | "error";

  const examples = [
    'Copy "Dinner Menu" to "Lunch Menu"',
    'Add vegetarian items to "Brunch Menu"',
    'Create user "Sam Rivera" as manager',
    "Summarize the restaurant data",
  ];

  let prompt = examples[0];
  let state: RunState = "idle";
  let message = "";
  let summary = "";
  let code = "";
  let planInput = "";
  let resultJson = "";
  let eventLog: string[] = [];
  let toolCalls: Record<string, string> = {};

  async function runAgent() {
    state = "planning";
    message = "";
    summary = "";
    code = "";
    planInput = "";
    resultJson = "";
    eventLog = [];
    toolCalls = {};

    try {
      const plan = await generateMockCodePlan({ prompt });
      summary = plan.summary;
      code = plan.code;
      planInput = JSON.stringify(plan.input, null, 2);
      state = "running";

      const result = await gruntend.runCodePlan(plan.code, {
        id: "sveltekit-agent-plan",
        input: plan.input,
        retry: { maxAttempts: 2 },
        handlers: createBrowserHandlers(fetch),
        onEvent: recordEvent,
      });

      resultJson = JSON.stringify(result, null, 2);

      if (result.status === "failed") {
        throw new Error(result.error ?? "The code plan failed.");
      }

      message = "Agent plan completed. Browse menus/users to see the updated API data.";
      state = "done";
    } catch (caught) {
      message = caught instanceof Error ? caught.message : String(caught);
      state = "error";
    }
  }

  function recordEvent(event: RuntimeEvent) {
    if (event.type === "tool.started") {
      toolCalls = { ...toolCalls, [event.callId]: `running ${event.tool}` };
      eventLog = [`${event.callId}: started ${event.tool}`, ...eventLog];
      return;
    }

    if (event.type === "tool.retrying") {
      toolCalls = { ...toolCalls, [event.callId]: `retrying ${event.tool}` };
      eventLog = [
        `${event.callId}: retry ${event.nextAttempt}/${event.maxAttempts} after ${event.error.message}`,
        ...eventLog,
      ];
      return;
    }

    if (event.type === "tool.completed") {
      toolCalls = { ...toolCalls, [event.callId]: `done ${event.tool}` };
      eventLog = [`${event.callId}: completed ${event.tool}`, ...eventLog];
      return;
    }

    if (event.type === "tool.failed") {
      toolCalls = { ...toolCalls, [event.callId]: `failed ${event.tool}` };
      eventLog = [`${event.callId}: failed ${event.error.message}`, ...eventLog];
      return;
    }

    eventLog = [event.type, ...eventLog];
  }
</script>

<section class="page-heading">
  <p class="eyebrow">Agent</p>
  <h1>Mock LLM → code plan → real app API.</h1>
  <p>
    The planner is mocked for now. The execution path is real: generated code calls registered Gruntend tools, and
    handlers call this SvelteKit app's API routes.
  </p>
</section>

<section class="panel composer">
  <label for="prompt">Task</label>
  <textarea id="prompt" bind:value={prompt} rows="4"></textarea>

  <div class="examples">
    {#each examples as example}
      <button type="button" on:click={() => (prompt = example)}>{example}</button>
    {/each}
  </div>

  <button class="button" type="button" disabled={state === "planning" || state === "running"} on:click={runAgent}>
    {state === "planning" ? "Planning..." : state === "running" ? "Running..." : "Run agent"}
  </button>
</section>

{#if summary}
  <section class="panel">
    <p class="eyebrow">Mock planner summary</p>
    <h2>{summary}</h2>
  </section>
{/if}

{#if code}
  <section class="split">
    <article class="panel">
      <h2>Plan input</h2>
      <pre>{planInput}</pre>
    </article>
    <article class="panel">
      <h2>Generated code plan</h2>
      <pre>{code}</pre>
    </article>
  </section>
{/if}

{#if Object.keys(toolCalls).length > 0}
  <section class="panel">
    <h2>Tool calls</h2>
    <div class="calls">
      {#each Object.entries(toolCalls) as [callId, status]}
        <p><code>{callId}</code> {status}</p>
      {/each}
    </div>
  </section>
{/if}

{#if eventLog.length > 0}
  <section class="panel">
    <h2>Runtime event stream</h2>
    <ul>
      {#each eventLog.slice(0, 12) as event}
        <li>{event}</li>
      {/each}
    </ul>
  </section>
{/if}

{#if resultJson}
  <section class="panel result" class:error={state === "error"}>
    <h2>Result</h2>
    <pre>{resultJson}</pre>
    {#if message}<p>{message}</p>{/if}
    {#if state === "done"}
      <div class="actions">
        <a class="button" href="/menus">View menus</a>
        <a class="secondary" href="/users">View users</a>
      </div>
    {/if}
  </section>
{/if}

{#if message && !resultJson}
  <section class="panel" class:error={state === "error"}>
    <p>{message}</p>
  </section>
{/if}

<style>
  .page-heading {
    max-width: 820px;
    margin-bottom: 24px;
  }

  .composer {
    display: grid;
    gap: 14px;
  }

  label {
    font-weight: 900;
    color: #e5e7eb;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 18px;
    background: #020617;
    color: #e5e7eb;
    padding: 14px;
  }

  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .examples button,
  .secondary {
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.7);
    color: #cbd5e1;
    padding: 8px 12px;
    cursor: pointer;
    text-decoration: none;
  }

  .split {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr);
    gap: 16px;
    margin-top: 16px;
  }

  pre {
    overflow-x: auto;
    margin: 0;
    border-radius: 18px;
    background: #020617;
    color: #bae6fd;
    padding: 16px;
  }

  code {
    color: #38bdf8;
    margin-right: 8px;
  }

  .calls p {
    margin: 0 0 8px;
  }

  .result {
    margin-top: 16px;
  }

  .error {
    border-color: rgba(248, 113, 113, 0.5);
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  @media (max-width: 820px) {
    .split {
      grid-template-columns: 1fr;
    }
  }
</style>
