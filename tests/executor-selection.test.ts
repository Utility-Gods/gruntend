import { expect, test } from "vitest";
import { createGruntendClient } from "../src/client.ts";
import { runCodePlan } from "../src/code-plan.ts";
import {
  CodePlanExecutorError,
  type CodePlanExecutor,
} from "../src/executor.ts";
import { createToolRegistry } from "../src/registry.ts";
import { defineTools, type ToolHandlerMap } from "../src/tool.ts";
import { createUiTemplateTag } from "../src/ui-runtime.ts";
import * as v from "valibot";

function trackingExecutor(
  id: string,
  calls: string[],
  execute: CodePlanExecutor["execute"] = ({ code }) => code,
  supportsGeneratedUi = false,
): CodePlanExecutor {
  return {
    profile: { id, trust: "controlled", supportsGeneratedUi },
    execute(context) {
      calls.push(id);
      return execute(context);
    },
  };
}

const emptyTools = defineTools({});
const emptyRegistry = createToolRegistry(emptyTools);

test("client uses its selected executor and an explicit per-run override", async () => {
  const calls: string[] = [];
  const defaultExecutor = trackingExecutor("default", calls);
  const overrideExecutor = trackingExecutor("override", calls);
  const client = createGruntendClient({
    tools: emptyTools,
    executor: defaultExecutor,
  });

  const first = await client.runCodePlan("first", { handlers: {} });
  const second = await client.runCodePlan("second", {
    handlers: {},
    executor: overrideExecutor,
  });

  expect(first.result).toBe("first");
  expect(second.result).toBe("second");
  expect(calls).toEqual(["default", "override"]);
});

test("sequential and concurrent plans remain pinned to their executors", async () => {
  const calls: string[] = [];
  const first = trackingExecutor("first", calls, async ({ code }) => {
    await Promise.resolve();
    return `first:${code}`;
  });
  const second = trackingExecutor("second", calls, async ({ code }) => {
    await Promise.resolve();
    return `second:${code}`;
  });

  const sequentialA = await runCodePlan({
    code: "a",
    executor: first,
    registry: emptyRegistry,
    handlers: {},
  });
  const sequentialB = await runCodePlan({
    code: "b",
    executor: second,
    registry: emptyRegistry,
    handlers: {},
  });
  const [concurrentA, concurrentB] = await Promise.all([
    runCodePlan({
      code: "c",
      executor: first,
      registry: emptyRegistry,
      handlers: {},
    }),
    runCodePlan({
      code: "d",
      executor: second,
      registry: emptyRegistry,
      handlers: {},
    }),
  ]);

  expect([sequentialA.result, sequentialB.result]).toEqual([
    "first:a",
    "second:b",
  ]);
  expect([concurrentA.result, concurrentB.result]).toEqual([
    "first:c",
    "second:d",
  ]);
  expect(calls).toEqual(["first", "second", "first", "second"]);
});

test("unsupported generated UI fails before the executor runs", async () => {
  const calls: string[] = [];
  const executor = trackingExecutor("data-only", calls);
  const result = await runCodePlan({
    code: "return html`<p>no</p>`;",
    executor,
    registry: emptyRegistry,
    handlers: {},
    ui: { html: createUiTemplateTag() },
  });

  expect(calls).toEqual([]);
  expect(result.errorCode).toBe("executor_unsupported_generated_ui");
  expect(result.executorId).toBe("data-only");
});

test("executor initialization and thrown execution failures are normalized once", async () => {
  for (const [id, error] of [
    [
      "initialization",
      new CodePlanExecutorError(
        "executor_initialization_failed",
        "WASM unavailable",
      ),
    ],
    ["execution", new Error("executor crashed")],
  ] as const) {
    const calls: string[] = [];
    const executor = trackingExecutor(id, calls, () => {
      throw error;
    });
    const result = await runCodePlan({
      code: "ignored",
      executor,
      registry: emptyRegistry,
      handlers: {},
    });

    expect(calls).toEqual([id]);
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe(
      id === "initialization"
        ? "executor_initialization_failed"
        : "executor_execution_failed",
    );
  }
});

test("an executor abort produces one failure without invoking another executor", async () => {
  const calls: string[] = [];
  const controller = new AbortController();
  const executor = trackingExecutor(
    "selected",
    calls,
    ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () =>
            reject(new CodePlanExecutorError("executor_aborted", "aborted")),
          { once: true },
        );
      }),
  );

  const pending = runCodePlan({
    code: "wait",
    executor,
    registry: emptyRegistry,
    handlers: {},
    signal: controller.signal,
  });
  controller.abort();
  const result = await pending;

  expect(calls).toEqual(["selected"]);
  expect(result.errorCode).toBe("executor_aborted");
});

test("a failure after a successful mutation is never replayed or sent to the client default", async () => {
  const tools = defineTools({
    mutate: {
      description: "Perform one mutation.",
      input: v.object({ value: v.number() }),
      output: v.object({ applied: v.boolean() }),
    },
  });
  let mutations = 0;
  const handlers = {
    mutate: ({ ok }) => {
      mutations += 1;
      return ok({ applied: true });
    },
  } satisfies ToolHandlerMap<typeof tools>;
  const calls: string[] = [];
  const fallback = trackingExecutor("must-not-run", calls);
  const selected = trackingExecutor("selected", calls, async ({ globals }) => {
    const mutate = globals.tools.mutate as (input: {
      value: number;
    }) => Promise<unknown>;
    await mutate({ value: 1 });
    throw new Error("failed after mutation");
  });
  const client = createGruntendClient({ tools, executor: fallback });

  const result = await client.runCodePlan("ignored", {
    executor: selected,
    handlers,
  });

  expect(result.status).toBe("failed");
  expect(mutations).toBe(1);
  expect(calls).toEqual(["selected"]);
});
