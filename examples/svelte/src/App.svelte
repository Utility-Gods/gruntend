<script lang="ts">
  import { genopen } from "./client.ts";
  import { generateMenuWorkflow, type MenuRequestData } from "./mock-llm.ts";
  import WorkflowPreview, { type WorkflowStepStatus } from "./WorkflowPreview.svelte";
  import type { WorkflowMachineConfig, WorkflowRuntimeEvent } from "../../../mod.ts";

  type RunState = "idle" | "running" | "done" | "error";
  type Page = "demo" | "options";
  type RetryDemoMode = "off" | "first-item-once" | "random-item-once";

  let page: Page = "demo";
  let state: RunState = "idle";
  let input = JSON.stringify(
    {
      menuName: "Dinner Menu",
      items: [
        { name: "Burger", price: 12 },
        { name: "Fries", price: 5 },
        { name: "Lemonade", price: 4 },
      ],
    },
    null,
    2,
  );
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let message = "";
  let createdMenu = "";
  let createdItems: string[] = [];
  let lastWorkflow: WorkflowMachineConfig | null = null;
  let lastFinalState = "";
  let runningStates: Record<string, WorkflowStepStatus> = {};
  let retryMessages: Record<string, string> = {};
  let eventLog: string[] = [];

  let authToken = "demo-auth-token";
  let tenantId = "restaurant-demo";
  let retryMode: RetryDemoMode = "first-item-once";
  let menuDelayMs = 900;
  let itemDelayMs = 1100;

  function logEvent(event: WorkflowRuntimeEvent) {
    if (event.type === "tool.retrying") {
      eventLog = [
        `Retrying ${event.state}: attempt ${event.nextAttempt}/${event.maxAttempts} after ${event.error.message}`,
        ...eventLog,
      ];
      return;
    }

    if (event.type.startsWith("tool.")) {
      eventLog = [`${event.type} ${event.state}`, ...eventLog];
      return;
    }

    eventLog = [event.type, ...eventLog];
  }

  function shouldRetryItem(itemName: string, attempt: number, retryItemName: string | null): boolean {
    if (attempt !== 1 || retryMode === "off") return false;
    if (retryMode === "first-item-once") return itemName === retryItemName;
    if (retryMode === "random-item-once") return itemName === retryItemName;
    return false;
  }

  async function askAssistant() {
    state = "running";
    message = "";
    createdMenu = "";
    createdItems = [];
    lastFinalState = "";
    runningStates = {};
    retryMessages = {};
    eventLog = [];

    try {
      const data = JSON.parse(input) as MenuRequestData;
      const workflow = await generateMenuWorkflow(data);
      const retryItemName = retryMode === "off"
        ? null
        : retryMode === "first-item-once"
        ? data.items[0]?.name ?? null
        : data.items[Math.floor(Math.random() * data.items.length)]?.name ?? null;

      lastWorkflow = workflow;
      runningStates = {};
      const result = await genopen.runWorkflow(workflow, {
        handlers: {
          "menu.create": async ({ input, ok, err }) => {
            if (!authToken) {
              return err({
                code: "MISSING_AUTH_TOKEN",
                message: "Missing app auth token.",
                retryable: false,
              });
            }

            await wait(menuDelayMs);

            return ok({
              menuId: `${tenantId}:menu:${input.name.toLowerCase().replaceAll(" ", "-")}`,
              name: input.name,
            });
          },
          "menu.item.create": async ({ input, ok, err, attempt, maxAttempts }) => {
            if (!authToken) {
              return err({
                code: "MISSING_AUTH_TOKEN",
                message: "Missing app auth token.",
                retryable: false,
              });
            }

            await wait(itemDelayMs);

            if (shouldRetryItem(input.name, attempt, retryItemName)) {
              return err({
                code: "DEMO_TEMPORARY_ITEM_FAILURE",
                message: `${input.name} failed temporarily on attempt ${attempt} of ${maxAttempts}.`,
                retryable: true,
                details: { demo: true, itemName: input.name },
              });
            }

            return ok({
              itemId: `${tenantId}:item:${input.menuId}:${input.name.toLowerCase().replaceAll(" ", "-")}`,
              menuId: input.menuId,
              name: input.name,
            });
          },
        },
        onEvent: (event) => {
          logEvent(event);

          if (event.type === "tool.started") {
            runningStates = { ...runningStates, [event.state]: "running" };
          }

          if (event.type === "tool.retrying") {
            runningStates = { ...runningStates, [event.state]: "retrying" };
            retryMessages = {
              ...retryMessages,
              [event.state]: `retry ${event.nextAttempt}/${event.maxAttempts}`,
            };
          }

          if (event.type === "tool.completed") {
            runningStates = { ...runningStates, [event.state]: "done" };
          }

          if (event.type === "tool.failed") {
            runningStates = { ...runningStates, [event.state]: "error" };
          }
        },
      });

      if (result.status !== "done") {
        throw new Error("The assistant workflow failed.");
      }

      const menu = result.outputs.createMenu?.data as { name: string; menuId: string } | undefined;
      createdMenu = menu ? `${menu.name} (${menu.menuId})` : "Menu created";
      createdItems = Object.entries(result.outputs)
        .filter(([stateName]) => stateName.includes("createItem"))
        .map(([, output]) => (output.data as { name: string }).name);

      message = `Assistant completed the requested app actions using ${authToken}.`;
      lastFinalState = result.finalState;
      state = "done";
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      state = "error";
    }
  }
</script>

<main>
  <section class="hero">
    <p class="eyebrow">GenOpen reference app</p>
    <h1>Restaurant menu assistant</h1>
    <p>
      Paste structured menu data. The app sends it to a mock LLM, receives an XState workflow, and
      lets GenOpen execute registered app tools with local app context.
    </p>

    <nav class="tabs" aria-label="Demo pages">
      <button class:active={page === "demo"} type="button" on:click={() => (page = "demo")}>Run demo</button>
      <button class:active={page === "options"} type="button" on:click={() => (page = "options")}>Options</button>
    </nav>
  </section>

  {#if page === "options"}
    <section class="panel options-panel">
      <h2>Demo options</h2>
      <p>Use these controls to demo app-owned runtime context, expected failures, and retry behavior.</p>

      <div class="field-grid">
        <label>
          Auth token
          <input bind:value={authToken} placeholder="Leave empty to demo auth failure" />
        </label>

        <label>
          Tenant id
          <input bind:value={tenantId} />
        </label>

        <label>
          Retry demo
          <select bind:value={retryMode}>
            <option value="off">No forced retry</option>
            <option value="first-item-once">Retry first item once</option>
            <option value="random-item-once">Retry one random item once</option>
          </select>
        </label>

        <label>
          Menu delay (ms)
          <input type="number" min="0" bind:value={menuDelayMs} />
        </label>

        <label>
          Item delay (ms)
          <input type="number" min="0" bind:value={itemDelayMs} />
        </label>
      </div>

      <p class="hint">
        Retry works through handler results: the demo handler returns <code>err(&#123; retryable: true &#125;)</code> once,
        GenOpen emits <code>tool.retrying</code>, then the next attempt returns <code>ok(...)</code>.
      </p>
    </section>
  {:else}
    <section class="panel">
      <label for="menu-data">Menu data</label>
      <textarea id="menu-data" bind:value={input} spellcheck="false"></textarea>
      <button disabled={state === "running"} on:click={askAssistant}>
        {state === "running" ? "Working..." : "Ask assistant to create menu"}
      </button>
    </section>

    {#if lastWorkflow}
      <details class="panel debug workflow-panel" open>
        <summary>Developer workflow preview</summary>

        <WorkflowPreview
          workflow={lastWorkflow}
          statuses={runningStates}
          retryMessages={retryMessages}
          finalState={lastFinalState}
        />
      </details>
    {/if}

    {#if eventLog.length > 0}
      <section class="panel event-log">
        <h2>Runtime event stream</h2>
        <ul>
          {#each eventLog.slice(0, 8) as entry}
            <li>{entry}</li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if message}
      <section class:error={state === "error"} class="panel result">
        <h2>{state === "error" ? "Could not complete request" : "Created in app"}</h2>
        <p>{message}</p>

        {#if createdMenu}
          <h3>{createdMenu}</h3>
        {/if}

        {#if createdItems.length > 0}
          <ul>
            {#each createdItems as item}
              <li>{item}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f8fafc;
    color: #111827;
  }

  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 64px 24px;
  }

  .workflow-panel {
    width: min(calc(100vw - 48px), 1500px);
    margin-left: 50%;
    transform: translateX(-50%);
  }

  .hero {
    margin-bottom: 32px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #2563eb;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 12px;
    font-size: clamp(2.25rem, 7vw, 4.5rem);
    line-height: 1;
  }

  p {
    color: #4b5563;
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-top: 22px;
  }

  .tabs button {
    margin-top: 0;
    background: #e0e7ff;
    color: #1e3a8a;
  }

  .tabs button.active {
    background: #2563eb;
    color: white;
  }

  .panel {
    margin-top: 20px;
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    background: white;
    box-shadow: 0 16px 40px rgb(15 23 42 / 8%);
  }

  label {
    display: block;
    margin-bottom: 10px;
    font-weight: 800;
  }

  textarea,
  input,
  select {
    box-sizing: border-box;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 14px;
    color: #111827;
    background: #f9fafb;
  }

  textarea {
    min-height: 220px;
    resize: vertical;
    padding: 16px;
    font: 0.95rem ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  }

  input,
  select {
    margin-top: 8px;
    font: inherit;
  }

  button {
    margin-top: 16px;
    padding: 12px 16px;
    border: 0;
    border-radius: 12px;
    background: #2563eb;
    color: white;
    font-weight: 800;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .hint {
    margin: 14px 0 0;
    padding: 14px;
    border-radius: 14px;
    background: #eff6ff;
  }

  .debug summary {
    cursor: pointer;
    font-weight: 800;
  }

  .event-log ul {
    display: grid;
    gap: 8px;
    padding-left: 0;
    list-style: none;
  }

  .event-log li {
    padding: 10px 12px;
    border-radius: 12px;
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
  }

  .result {
    border-color: #bbf7d0;
    background: #f0fdf4;
  }

  .result.error {
    border-color: #fecaca;
    background: #fef2f2;
  }

  ul {
    margin-bottom: 0;
    padding-left: 20px;
  }

  @media (max-width: 720px) {
    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
