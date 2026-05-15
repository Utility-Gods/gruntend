<script lang="ts">
  import { genopen } from "./client.ts";
  import { generateMenuWorkflow, type MenuRequestData } from "./mock-llm.ts";
  import WorkflowPreview, { type WorkflowStepStatus } from "./WorkflowPreview.svelte";
  import type { WorkflowMachineConfig } from "../../../mod.ts";

  type RunState = "idle" | "running" | "done" | "error";

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

  let authToken = "demo-auth-token";
  let tenantId = "restaurant-demo";

  async function askAssistant() {
    state = "running";
    message = "";
    createdMenu = "";
    createdItems = [];
    lastFinalState = "";
    runningStates = {};

    try {
      const data = JSON.parse(input) as MenuRequestData;
      const workflow = await generateMenuWorkflow(data);
      lastWorkflow = workflow;
      runningStates = {};
      const result = await genopen.runWorkflow(workflow, {
        handlers: {
          "menu.create": async ({ input, ok, err }) => {
            if (!authToken) {
              return err({
                code: "MISSING_AUTH_TOKEN",
                message: "Missing app auth token.",
                
              });
            }

            await wait(3000);

            return ok({
              menuId: `${tenantId}:menu:${input.name.toLowerCase().replaceAll(" ", "-")}`,
              name: input.name,
            });
          },
          "menu.item.create": async ({ input, ok, err }) => {
            if (!authToken) {
              return err({
                code: "MISSING_AUTH_TOKEN",
                message: "Missing app auth token.",
              });
            }

            await wait(3500);

            return ok({
              itemId: `${tenantId}:item:${input.menuId}:${input.name.toLowerCase().replaceAll(" ", "-")}`,
              menuId: input.menuId,
              name: input.name,
            });
          },
        },
        onEvent: (event) => {
          if (event.type === "tool.started") {
            runningStates = { ...runningStates, [event.state]: "running" };
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
  </section>

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

      <WorkflowPreview workflow={lastWorkflow} statuses={runningStates} finalState={lastFinalState} />
    </details>
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

  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 220px;
    resize: vertical;
    padding: 16px;
    border: 1px solid #d1d5db;
    border-radius: 14px;
    font: 0.95rem ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    color: #111827;
    background: #f9fafb;
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

  .debug summary {
    cursor: pointer;
    font-weight: 800;
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
</style>
