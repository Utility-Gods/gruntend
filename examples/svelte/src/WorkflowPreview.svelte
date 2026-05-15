<script lang="ts">
  import type { WorkflowJsonValue, WorkflowMachineConfig, WorkflowStateConfig } from "../../../mod.ts";

  export type WorkflowStepStatus = "pending" | "running" | "done" | "error";

  interface Props {
    workflow: WorkflowMachineConfig;
    statuses?: Record<string, WorkflowStepStatus>;
    finalState?: string;
  }

  interface DiagramStep {
    readonly state: string;
    readonly tool: string;
    readonly input: Record<string, WorkflowJsonValue>;
  }

  let { workflow, statuses = {}, finalState = "" }: Props = $props();

  const topLevelSteps = $derived(topLevelInvokeSteps(workflow));
  const parallelRegions = $derived(topLevelParallelRegions(workflow));

  function topLevelInvokeSteps(workflow: WorkflowMachineConfig): DiagramStep[] {
    return Object.entries(workflow.states).flatMap(([stateName, state]) =>
      state.invoke ? [toStep(stateName, state)] : []
    );
  }

  function topLevelParallelRegions(workflow: WorkflowMachineConfig): Array<{ name: string; steps: DiagramStep[] }> {
    return Object.entries(workflow.states).flatMap(([stateName, state]) => {
      if (state.type !== "parallel" || !state.states) return [];

      return [{
        name: stateName,
        steps: Object.entries(state.states).flatMap(([regionName, region]) =>
          collectInvokes(`${stateName}.${regionName}`, region)
        ),
      }];
    });
  }

  function collectInvokes(path: string, state: WorkflowStateConfig): DiagramStep[] {
    const current = state.invoke ? [toStep(path, state)] : [];
    const children = state.states
      ? Object.entries(state.states).flatMap(([childName, child]) => collectInvokes(`${path}.${childName}`, child))
      : [];

    return [...current, ...children];
  }

  function toStep(state: string, config: WorkflowStateConfig): DiagramStep {
    if (!config.invoke) throw new Error(`State "${state}" does not invoke a tool.`);

    return {
      state,
      tool: config.invoke.input.tool,
      input: config.invoke.input.params,
    };
  }

  function outputPath(state: string): string {
    return `${state}.data`;
  }

  function humanizeState(state: string): string {
    return state
      .split(".")
      .at(-2)
      ?.replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? state;
  }

  function isRefRecord(value: WorkflowJsonValue): value is { $ref: string } {
    return typeof value === "object" && value !== null && !Array.isArray(value) && "$ref" in value;
  }

  function refLabel(ref: string): string {
    return ref.replace(".data.", " → ");
  }

  function formatValue(value: WorkflowJsonValue): string {
    if (isRefRecord(value)) return refLabel(value.$ref);
    if (typeof value === "number") return `$${value}`;
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value === null) return "None";
    return "Provided by workflow";
  }

  function inputSummary(input: Record<string, WorkflowJsonValue>): Array<{ label: string; value: string; kind?: string }> {
    return Object.entries(input).map(([key, value]) => ({
      label: key.replace(/([a-z])([A-Z])/g, "$1 $2"),
      value: formatValue(value),
      kind: isRefRecord(value) ? "ref" : undefined,
    }));
  }

  function outputSummary(step: DiagramStep): string {
    if (step.tool === "menu.create") return "Menu id and menu name";
    if (step.tool === "menu.item.create") return "Created item id";
    return `Saved as ${outputPath(step.state)}`;
  }
</script>

<div class="statechart" aria-label="Generated state machine preview">
  <div class="chart-column">
    <div class="terminal start">start</div>
    <div class="connector vertical"></div>

    {#each topLevelSteps as step}
      <div
        class:running={statuses[step.state] === "running"}
        class:done={statuses[step.state] === "done"}
        class:error={statuses[step.state] === "error"}
        class="state-card primary"
      >
        <span class="state-kind">
          {#if statuses[step.state] === "running"}<span class="spinner"></span>{/if}
          {statuses[step.state] || "pending"}
        </span>
        <strong>{humanizeState(step.state)}</strong>
        <span class="tool-name">{step.tool}</span>
        <div class="step-details">
          {#each inputSummary(step.input) as item}
            <div class:ref={item.kind === "ref"} class="detail-pill">
              <span>{item.label}</span>
              <b>{item.value}</b>
            </div>
          {/each}
          <div class="detail-pill output">
            <span>Creates</span>
            <b>{outputSummary(step)}</b>
          </div>
        </div>
      </div>
      <div class="connector vertical"></div>
    {/each}

    {#each parallelRegions as region}
      <div class="fork"><span>{region.name}<br />parallel</span></div>
      <div class="connector vertical"></div>

      <div class="parallel-region">
        {#each region.steps as step}
          <div class="lane">
            <div
              class:running={statuses[step.state] === "running"}
              class:done={statuses[step.state] === "done"}
              class:error={statuses[step.state] === "error"}
              class="state-card"
            >
              <span class="state-kind">
                {#if statuses[step.state] === "running"}<span class="spinner"></span>{/if}
                {statuses[step.state] || "pending"}
              </span>
              <strong>{humanizeState(step.state)}</strong>
              <span class="tool-name">{step.tool}</span>
              <div class="step-details">
                {#each inputSummary(step.input) as item}
                  <div class:ref={item.kind === "ref"} class="detail-pill">
                    <span>{item.label}</span>
                    <b>{item.value}</b>
                  </div>
                {/each}
                <div class="detail-pill output">
                  <span>Creates</span>
                  <b>{outputSummary(step)}</b>
                </div>
              </div>
            </div>
            <div class="connector vertical small-line"></div>
            <div class="terminal small">done</div>
          </div>
        {/each}
      </div>

      <div class="connector vertical"></div>
      <div class="fork join"><span>join</span></div>
      <div class="connector vertical"></div>
    {/each}

    <div class="terminal completed">{finalState || "completed"}</div>
  </div>
</div>

<style>
  .statechart {
    overflow-x: auto;
    margin-top: 18px;
    padding: 24px;
    border: 1px solid #dbeafe;
    border-radius: 16px;
    background:
      radial-gradient(circle at 24px 24px, #dbeafe 1px, transparent 1px),
      #f8fbff;
    background-size: 24px 24px;
  }

  .chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 100%;
  }

  .terminal,
  .fork,
  .state-card {
    flex: 0 0 auto;
  }

  .terminal {
    padding: 10px 16px;
    border-radius: 999px;
    background: #111827;
    color: white;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .terminal.completed {
    background: #16a34a;
  }

  .terminal.small {
    padding: 8px 12px;
    background: #e0f2fe;
    color: #075985;
    font-size: 0.75rem;
  }

  .state-card {
    display: grid;
    gap: 8px;
    width: 340px;
    padding: 16px;
    border: 2px solid #93c5fd;
    border-radius: 16px;
    background: white;
    box-shadow: 0 10px 24px rgb(37 99 235 / 12%);
  }

  .state-card.primary {
    border-color: #2563eb;
  }

  .state-card.running {
    border-color: #f59e0b;
    background: #fffbeb;
    animation: pulse 1s ease-in-out infinite;
  }

  .state-card.done {
    border-color: #22c55e;
    background: #f0fdf4;
  }

  .state-card.error {
    border-color: #ef4444;
    background: #fef2f2;
  }

  .state-kind {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #2563eb;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #fed7aa;
    border-top-color: #f59e0b;
    border-radius: 999px;
    animation: spin 0.75s linear infinite;
  }

  .state-card strong {
    color: #111827;
    font-size: 1.05rem;
  }

  .tool-name {
    width: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1e3a8a;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .step-details {
    display: grid;
    gap: 8px;
    margin-top: 4px;
  }

  .detail-pill {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 9px 10px;
    border: 1px solid #dbeafe;
    border-radius: 12px;
    background: #f8fbff;
  }

  .detail-pill span {
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .detail-pill b {
    overflow: hidden;
    color: #0f172a;
    font-size: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-pill.ref {
    background: #ecfeff;
    border-color: #bae6fd;
  }

  .detail-pill.output {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .connector {
    position: relative;
    background: #2563eb;
  }

  .connector.vertical {
    width: 2px;
    height: 38px;
  }

  .connector.vertical::after {
    content: "";
    position: absolute;
    left: -5px;
    bottom: -1px;
    border-top: 8px solid #2563eb;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
  }

  .small-line {
    height: 24px;
  }

  .fork {
    display: grid;
    place-items: center;
    width: 104px;
    height: 104px;
    transform: rotate(45deg);
    border: 2px solid #f59e0b;
    border-radius: 16px;
    background: #fffbeb;
    color: #92400e;
    font-size: 0.78rem;
    font-weight: 900;
    text-align: center;
  }

  .fork span {
    transform: rotate(-45deg);
  }

  .fork.join {
    border-color: #22c55e;
    background: #f0fdf4;
    color: #166534;
  }

  .parallel-region {
    display: flex;
    gap: 18px;
    align-items: flex-start;
    max-width: calc(100vw - 96px);
    overflow-x: auto;
    padding: 18px;
    border: 2px dashed #93c5fd;
    border-radius: 18px;
    background: rgb(239 246 255 / 70%);
  }

  .lane {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgb(245 158 11 / 45%);
    }
    50% {
      box-shadow: 0 0 0 10px rgb(245 158 11 / 0%);
    }
  }
</style>
