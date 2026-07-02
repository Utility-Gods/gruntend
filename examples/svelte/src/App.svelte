<script lang="ts">
  import { gruntend } from "./client.ts";
  import { generateMenuCodePlan, type MenuRequestData } from "./mock-llm.ts";
  import type { RuntimeEvent } from "gruntend/runtime";

  type RunState = "idle" | "running" | "done" | "error";
  type Page = "demo" | "options";
  type RetryDemoMode = "off" | "first-item-once" | "random-item-once";

  interface CodePlanResult {
    readonly menu: {
      readonly menuId: string;
      readonly name: string;
    };
    readonly items: readonly {
      readonly itemId: string;
      readonly menuId: string;
      readonly name: string;
    }[];
  }

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

  let message = "";
  let createdMenu = "";
  let createdItems: string[] = [];
  let lastCodePlan = "";
  let eventLog: string[] = [];
  let callStatuses: Record<string, string> = {};

  let authToken = "demo-auth-token";
  let tenantId = "restaurant-demo";
  let retryMode: RetryDemoMode = "first-item-once";
  let menuDelayMs = 600;
  let itemDelayMs = 800;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function logEvent(event: RuntimeEvent) {
    if (event.type === "tool.started") {
      callStatuses = { ...callStatuses, [event.callId]: `running ${event.tool}` };
      eventLog = [`${event.callId}: started ${event.tool}`, ...eventLog];
      return;
    }

    if (event.type === "tool.retrying") {
      callStatuses = { ...callStatuses, [event.callId]: `retrying ${event.tool}` };
      eventLog = [
        `${event.callId}: retry ${event.nextAttempt}/${event.maxAttempts} after ${event.error.message}`,
        ...eventLog,
      ];
      return;
    }

    if (event.type === "tool.completed") {
      callStatuses = { ...callStatuses, [event.callId]: `done ${event.tool}` };
      eventLog = [`${event.callId}: completed ${event.tool}`, ...eventLog];
      return;
    }

    if (event.type === "tool.failed") {
      callStatuses = { ...callStatuses, [event.callId]: `failed ${event.tool}` };
      eventLog = [`${event.callId}: failed ${event.error.message}`, ...eventLog];
      return;
    }

    eventLog = [event.type, ...eventLog];
  }

  function shouldRetryItem(itemName: string, attempt: number, retryItemName: string | null): boolean {
    if (attempt !== 1 || retryMode === "off") return false;
    return itemName === retryItemName;
  }

  async function askAssistant() {
    state = "running";
    message = "";
    createdMenu = "";
    createdItems = [];
    lastCodePlan = "";
    eventLog = [];
    callStatuses = {};

    try {
      const data = JSON.parse(input) as MenuRequestData;
      const code = await generateMenuCodePlan(data);
      const retryItemName = retryMode === "off"
        ? null
        : retryMode === "first-item-once"
        ? data.items[0]?.name ?? null
        : data.items[Math.floor(Math.random() * data.items.length)]?.name ?? null;

      lastCodePlan = code;

      const result = await gruntend.runCodePlan(code, {
        id: "create-menu-from-data",
        retry: { maxAttempts: 2 },
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
        onEvent: logEvent,
      });

      if (result.status !== "done") {
        throw new Error(result.error ?? "The assistant code plan failed.");
      }

      const planResult = result.result as CodePlanResult;
      createdMenu = `${planResult.menu.name} (${planResult.menu.menuId})`;
      createdItems = planResult.items.map((item) => item.name);
      message = `Assistant completed the requested app actions using ${authToken}.`;
      state = "done";
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      state = "error";
    }
  }
</script>

<main>
  <section class="hero">
    <p class="eyebrow">Gruntend reference app</p>
    <h1>Restaurant menu assistant</h1>
    <p>
      Paste structured menu data. A mock LLM returns a small code plan, and Gruntend executes only the registered
      app tools behind that plan.
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
    </section>
  {:else}
    <section class="panel">
      <label for="menu-data">Menu data</label>
      <textarea id="menu-data" bind:value={input} spellcheck="false"></textarea>
      <button disabled={state === "running"} on:click={askAssistant}>
        {state === "running" ? "Working..." : "Ask assistant to create menu"}
      </button>
    </section>

    {#if lastCodePlan}
      <section class="panel code-plan">
        <h2>Generated code plan</h2>
        <pre>{lastCodePlan}</pre>
      </section>
    {/if}

    {#if Object.keys(callStatuses).length > 0}
      <section class="panel trace">
        <h2>Tool calls</h2>
        <ul>
          {#each Object.entries(callStatuses) as [callId, status]}
            <li><span>{callId}</span>{status}</li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if eventLog.length > 0}
      <section class="panel event-log">
        <h2>Runtime event stream</h2>
        <ul>
          {#each eventLog.slice(0, 10) as entry}
            <li>{entry}</li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if state === "done"}
      <section class="panel success">
        <h2>Created menu</h2>
        <p>{createdMenu}</p>
        <ul>
          {#each createdItems as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if message}
      <section class="panel" class:error={state === "error"}>
        <p>{message}</p>
      </section>
    {/if}
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    min-height: 100vh;
    background: #0f172a;
    color: #e5e7eb;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  main {
    width: min(980px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 48px 0;
  }

  .hero {
    margin-bottom: 24px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #38bdf8;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    font-size: clamp(2rem, 6vw, 4rem);
    line-height: 1;
    margin-bottom: 16px;
  }

  .hero p:not(.eyebrow) {
    color: #cbd5e1;
    max-width: 720px;
    font-size: 1.1rem;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-top: 24px;
  }

  button,
  input,
  select,
  textarea {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    font: inherit;
  }

  button {
    cursor: pointer;
    background: #38bdf8;
    color: #082f49;
    border: 0;
    padding: 12px 18px;
    font-weight: 800;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .tabs button {
    background: rgba(15, 23, 42, 0.65);
    color: #e5e7eb;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .tabs button.active {
    background: #e0f2fe;
    color: #075985;
  }

  .panel {
    background: rgba(15, 23, 42, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 24px;
    padding: 22px;
    margin: 16px 0;
    box-shadow: 0 24px 80px rgba(2, 6, 23, 0.35);
  }

  label {
    display: grid;
    gap: 8px;
    color: #cbd5e1;
    font-weight: 700;
  }

  textarea {
    min-height: 180px;
    resize: vertical;
    margin: 8px 0 14px;
    padding: 14px;
    width: 100%;
    box-sizing: border-box;
    background: #020617;
    color: #e5e7eb;
  }

  input,
  select {
    padding: 10px 12px;
    background: #020617;
    color: #e5e7eb;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  pre {
    overflow-x: auto;
    margin: 0;
    background: #020617;
    border-radius: 18px;
    padding: 18px;
    color: #bae6fd;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  .trace li {
    margin-bottom: 8px;
  }

  .trace span {
    display: inline-block;
    min-width: 56px;
    color: #38bdf8;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .success {
    border-color: rgba(34, 197, 94, 0.45);
  }

  .error {
    border-color: rgba(248, 113, 113, 0.5);
    color: #fecaca;
  }
</style>
