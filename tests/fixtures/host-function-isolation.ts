import { runCodePlan } from "../../src/code-plan.ts";
import type { CodePlanExecutor } from "../../src/executor.ts";
import { createToolRegistry } from "../../src/registry.ts";
import { defineTools } from "../../src/tool.ts";

export async function runHostFunctionIsolationFixture(
  executor: CodePlanExecutor,
) {
  const registry = createToolRegistry(defineTools({}));
  const events: unknown[] = [];
  const hostContextKey = "__gruntendHostContextCanary__";
  const hostContextValue = "must-not-be-visible-to-code-plans";
  const hostGlobal = globalThis as typeof globalThis & Record<string, unknown>;
  hostGlobal[hostContextKey] = hostContextValue;

  try {
    const result = await runCodePlan({
      code: `
        var functionPrototype = Object.getPrototypeOf(console.log);
        var descriptor = Object.getOwnPropertyDescriptor(
          functionPrototype,
          "constructor"
        );
        var HostFunction = descriptor.value;
        var readHostContext = HostFunction(
          "return globalThis.${hostContextKey};"
        );
        var leakedValue = readHostContext();
        console.log("host context", leakedValue);
        return leakedValue;
      `,
      registry,
      handlers: {},
      executor,
      onEvent: (event) => events.push(event),
    });

    const leakedToConsole = events.some(
      (event) =>
        typeof event === "object" &&
        event !== null &&
        "type" in event &&
        event.type === "plan.console" &&
        "args" in event &&
        Array.isArray(event.args) &&
        event.args.includes(hostContextValue),
    );

    return {
      status: result.status,
      result: result.result,
      leakedToConsole,
    };
  } finally {
    delete hostGlobal[hostContextKey];
  }
}
