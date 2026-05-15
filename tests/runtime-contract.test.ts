import { assertEquals } from "@std/assert";
import {
  createGenOpenClient,
  defineTool,
  type WorkflowMachineConfig,
} from "../mod.ts";
import * as v from "valibot";

Deno.test("runtime handlers are closures supplied when workflow is triggered", async () => {
  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({
      name: v.string(),
    }),
    output: v.object({
      menuId: v.string(),
    }),
  });

  const client = createGenOpenClient({
    tools: [createMenu],
  });

  const authToken = "runtime-token";
  const workflow: WorkflowMachineConfig = {
    id: "create-menu",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.create",
            params: {
              name: "Dinner",
            },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: {
        type: "final",
      },
      failed: {
        type: "final",
      },
    },
  };

  const result = await client.runWorkflow(workflow, {
    handlers: {
      "menu.create": async ({ input, ok }) => ok({
        menuId: `${authToken}:${input.name}`,
      }),
    },
  });

  assertEquals(result.status, "done");
  assertEquals(result.outputs.createMenu, {
    ok: true,
    data: {
      menuId: "runtime-token:Dinner",
    },
  });
});

Deno.test("runtime rejects invalid LLM tool input before calling the handler", async () => {
  let handlerCalls = 0;

  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({
      name: v.string(),
    }),
    output: v.object({
      menuId: v.string(),
    }),
  });

  const client = createGenOpenClient({
    tools: [createMenu],
  });

  const workflow: WorkflowMachineConfig = {
    id: "invalid-input",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.create",
            params: {
              name: 123,
            },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: {
        type: "final",
      },
      failed: {
        type: "final",
      },
    },
  };

  const result = await client.runWorkflow(workflow, {
    handlers: {
      "menu.create": ({ ok }) => {
        handlerCalls += 1;
        return ok({
          menuId: "should-not-run",
        });
      },
    },
  });

  assertEquals(handlerCalls, 0);
  assertEquals(result.status, "failed");
  assertEquals(result.finalState, "failed");
  assertEquals(result.errors.createMenu, {
    type: "invalid_input",
    state: "createMenu",
    tool: "menu.create",
    message: 'Tool "menu.create" received invalid input.',
  });
});

Deno.test("runtime rejects handler output that violates the tool output contract", async () => {
  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({
      name: v.string(),
    }),
    output: v.object({
      menuId: v.string(),
    }),
  });

  const client = createGenOpenClient({
    tools: [createMenu],
  });

  const workflow: WorkflowMachineConfig = {
    id: "invalid-output",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.create",
            params: {
              name: "Dinner",
            },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: {
        type: "final",
      },
      failed: {
        type: "final",
      },
    },
  };

  const result = await client.runWorkflow(workflow, {
    handlers: {
      "menu.create": ({ ok }) => ok({
        id: "wrong-shape",
      } as unknown as { menuId: string }),
    },
  });

  assertEquals(result.status, "failed");
  assertEquals(result.finalState, "failed");
  assertEquals(result.outputs, {});
  assertEquals(result.errors.createMenu, {
    type: "invalid_output",
    state: "createMenu",
    tool: "menu.create",
    message: 'Tool "menu.create" returned invalid output.',
  });
});
