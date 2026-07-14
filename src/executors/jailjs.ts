import { Interpreter } from "@mariozechner/jailjs";
import { transformToES5 } from "@mariozechner/jailjs/transform";
import type { CodePlanExecutor } from "../executor.ts";

export function createJailJsCodePlanExecutor(): CodePlanExecutor {
  return {
    profile: {
      id: "jailjs",
      trust: "controlled",
      supportsGeneratedUi: true,
    },
    async execute({ code, globals, maxOps }) {
      const ast = transformToES5(wrapCodePlan(code));
      const interpreter = new Interpreter(
        {
          input: globals.input,
          tools: globals.tools,
          console: globals.console,
          ...(globals.html ? { html: globals.html } : {}),
        },
        { maxOps },
      );
      return await interpreter.evaluate(ast);
    },
  };
}

function wrapCodePlan(code: string): string {
  return `(async () => {\n${stripMarkdownFence(code)}\n})();`;
}

function stripMarkdownFence(code: string): string {
  const trimmed = code.trim();
  const match = trimmed.match(
    /^```(?:ts|tsx|js|jsx|javascript|typescript)?\s*([\s\S]*?)\s*```$/,
  );
  return match ? match[1] : code;
}
