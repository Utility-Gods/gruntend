import { expect, test } from "vitest";
import {
  runCodePlan,
  type CodePlanUiRuntimeOptions,
} from "../src/code-plan.ts";
import type { CodePlanExecutor } from "../src/executor.ts";
import { createToolRegistry } from "../src/registry.ts";
import type { RuntimeEvent } from "../src/runtime.ts";
import { defineTools, type ToolHandlerMap } from "../src/tool.ts";
import {
  createUiComponent,
  createUiTemplateTag,
  type UiComponent,
} from "../src/ui-runtime.ts";
import * as v from "valibot";

interface ConformanceRunOptions {
  readonly input?: unknown;
  readonly signal?: AbortSignal;
  readonly ui?: CodePlanUiRuntimeOptions;
  readonly onEvent?: (event: RuntimeEvent) => void;
}

export function runExecutorConformance(
  name: string,
  executor: CodePlanExecutor,
  options: {
    readonly verifyCleanup?: (component: UiComponent) => void;
    readonly verifyLimit?: (executor: CodePlanExecutor) => Promise<void>;
  } = {},
): void {
  const tools = defineTools({
    math: {
      double: {
        description: "Double a number.",
        input: v.object({ value: v.number() }),
        output: v.object({ value: v.number() }),
      },
    },
    status: {
      read: {
        description: "Read status.",
        input: v.object({}),
        output: v.object({ status: v.string() }),
      },
    },
    reject: {
      description: "Return an expected failure.",
      input: v.object({}),
      output: v.object({ ok: v.boolean() }),
    },
    fail: {
      description: "Fail unexpectedly.",
      input: v.object({}),
      output: v.object({ ok: v.boolean() }),
    },
  });
  const registry = createToolRegistry(tools);
  const handlers = {
    "math.double": async ({ input, ok }) => ok({ value: input.value * 2 }),
    "status.read": async ({ ok }) => ok({ status: "ready" }),
    reject: ({ err }) =>
      err({
        code: "EXPECTED_REJECTION",
        message: "expected tool rejection",
        retryable: false,
      }),
    fail: () => {
      throw new Error("unexpected host fault");
    },
  } satisfies ToolHandlerMap<typeof tools>;

  const run = (code: string, runOptions: ConformanceRunOptions = {}) =>
    runCodePlan({
      ...runOptions,
      code,
      executor,
      registry,
      handlers,
    });

  test(`${name}: returns browser-local data`, async () => {
    const result = await run(
      "return { answer: input.value + 1, items: [true, null, 'ok'] };",
      { input: { value: 41 } },
    );
    expect(result).toEqual({
      status: "done",
      result: { answer: 42, items: [true, null, "ok"] },
      errors: {},
    });
  });

  test(`${name}: awaits async, parallel, and dotted tools`, async () => {
    const result = await run(`
      const values = await Promise.all([
        tools.math.double({ value: 2 }),
        tools.math.double({ value: 3 }),
      ]);
      const status = await tools["status.read"]({});
      return { values: values.map(item => item.value), status: status.status };
    `);
    expect(result.status).toBe("done");
    expect(result.result).toEqual({ values: [4, 6], status: "ready" });
  });

  test(`${name}: preserves validation and expected tool errors`, async () => {
    const invalid = await run(
      "return await tools.math.double({ value: 'bad' });",
    );
    expect(invalid.status).toBe("failed");
    expect(invalid.errors.call1?.type).toBe("invalid_input");

    const rejected = await run("return await tools.reject({});");
    expect(rejected.status).toBe("failed");
    expect(rejected.errors.call1).toMatchObject({
      type: "handler_error",
      code: "EXPECTED_REJECTION",
      retryable: false,
    });
  });

  test(`${name}: normalizes unexpected tool faults`, async () => {
    const result = await run("return await tools.fail({});");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("unexpected host fault");
    expect(result.errorCode).toBe("executor_execution_failed");
  });

  test(`${name}: forwards console events`, async () => {
    const events: unknown[] = [];
    const result = await run(
      "console.warn('value', input.value); return 'ok';",
      {
        input: { value: 7 },
        onEvent: (event) => events.push(event),
      },
    );
    expect(result.status).toBe("done");
    expect(events).toContainEqual({
      type: "plan.console",
      planId: "code-plan",
      level: "warn",
      args: ["value", 7],
    });
  });

  test(`${name}: respects preflight abort`, async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await run("return 'must not run';", {
      signal: controller.signal,
    });
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("executor_aborted");
  });

  test(`${name}: renders static templates`, async () => {
    const result = await run("return html`<p>Hello ${input.name}</p>`;", {
      input: { name: "Ada" },
      ui: { html: createUiTemplateTag() },
    });
    expect(result.status).toBe("done");
    const component = createUiComponent(result.result).unwrap();
    expect(component.render().unwrap().html).toBe("<p>Hello Ada</p>");
    component.destroy();
  });

  test(`${name}: retains closure-backed UI and cleans it up`, async () => {
    const result = await run(
      `
        let count = 0;
        return function render() {
          return html\`<button onclick=\${function () { count += 1; }}>\${count}</button>\`;
        };
      `,
      { ui: { html: createUiTemplateTag() } },
    );
    expect(result.status).toBe("done");
    const outcome = createUiComponent(result.result);
    const component = outcome.unwrap();
    expect(component.render().unwrap().html).toBe(
      '<button data-gr-click="h0">0</button>',
    );
    await component.dispatch("h0");
    expect(component.render().unwrap().html).toBe(
      '<button data-gr-click="h0">1</button>',
    );
    component.destroy();
    options.verifyCleanup?.(component);
  });

  if (options.verifyLimit) {
    test(`${name}: enforces implementation-appropriate limits`, async () => {
      await options.verifyLimit?.(executor);
    });
  }
}
