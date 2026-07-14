import { expect, test } from "vitest";
import { runCodePlan } from "../src/code-plan.ts";
import { createJailJsCodePlanExecutor } from "../src/executors/jailjs.ts";
import { createQuickJsBrowserCodePlanExecutor } from "../src/executors/quickjs-browser.ts";
import { createToolRegistry } from "../src/registry.ts";
import { defineTools } from "../src/tool.ts";
import { runExecutorConformance } from "./executor-conformance.ts";
import { runHostFunctionIsolationFixture } from "./fixtures/host-function-isolation.ts";

const jailJs = createJailJsCodePlanExecutor();

runExecutorConformance("jailjs", jailJs, {
  async verifyLimit(executor) {
    const result = await runCodePlan({
      code: "while (true) {}",
      executor,
      maxOps: 100,
      registry: createToolRegistry(defineTools({})),
      handlers: {},
    });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("maximum operations exceeded");
  },
});

test("JailJS declares controlled trust and is not an isolation executor", async () => {
  expect(jailJs.profile).toEqual({
    id: "jailjs",
    trust: "controlled",
    supportsGeneratedUi: true,
  });
  const fixture = await runHostFunctionIsolationFixture(jailJs);
  expect(fixture.result).toBe("must-not-be-visible-to-code-plans");
  expect(fixture.leakedToConsole).toBe(true);
});

const [quickJs, limitedQuickJs] = await Promise.all([
  createQuickJsBrowserCodePlanExecutor(),
  createQuickJsBrowserCodePlanExecutor({ timeoutMs: 20 }),
]);

runExecutorConformance("quickjs-browser", quickJs, {
  verifyCleanup(component) {
    expect(() => component.render()).toThrow("session was destroyed");
    component.destroy();
  },
  async verifyLimit() {
    const result = await runCodePlan({
      code: "while (true) {}",
      executor: limitedQuickJs,
      registry: createToolRegistry(defineTools({})),
      handlers: {},
    });
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("executor_execution_failed");
  },
});

test("QuickJS isolates host constructors and ambient browser globals", async () => {
  expect(quickJs.profile).toEqual({
    id: "quickjs-browser",
    trust: "isolated",
    supportsGeneratedUi: true,
  });

  const fixture = await runHostFunctionIsolationFixture(quickJs);
  expect(fixture.result).not.toBe("must-not-be-visible-to-code-plans");
  expect(fixture.leakedToConsole).toBe(false);

  const result = await runCodePlan({
    executor: quickJs,
    code: `
      const objectPrototype = Object.getPrototypeOf({});
      const reflectedConstructor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(function () {}),
        "constructor"
      ).value;
      return {
        globalIsGuest: globalThis !== input,
        window: typeof window,
        document: typeof document,
        fetch: typeof fetch,
        localStorage: typeof localStorage,
        sessionStorage: typeof sessionStorage,
        reflectedConstructorIsGuest: reflectedConstructor === Function,
        objectConstructorIsGuest: objectPrototype.constructor === Object,
        hostCanary: globalThis.__gruntendHostContextCanary__,
      };
    `,
    input: {},
    registry: createToolRegistry(defineTools({})),
    handlers: {},
  });

  expect(result.status).toBe("done");
  expect(result.result).toEqual({
    globalIsGuest: true,
    window: "undefined",
    document: "undefined",
    fetch: "undefined",
    localStorage: "undefined",
    sessionStorage: "undefined",
    reflectedConstructorIsGuest: true,
    objectConstructorIsGuest: true,
    hostCanary: undefined,
  });
});
