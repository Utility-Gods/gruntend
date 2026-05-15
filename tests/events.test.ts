import { assertEquals } from "@std/assert";
import { createGenOpenClient, defineTool, type WorkflowMachineConfig, type WorkflowRuntimeEvent } from "../mod.ts";
import * as v from "valibot";

Deno.test("runWorkflow emits workflow and tool lifecycle events through onEvent", async () => {
  const events: WorkflowRuntimeEvent[] = [];
  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({ name: v.string() }),
    output: v.object({ menuId: v.string() }),
  });
  const client = createGenOpenClient({ tools: [createMenu] });
  const workflow: WorkflowMachineConfig = {
    id: "create-menu",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: { tool: "menu.create", params: { name: "Dinner" } },
          onDone: "completed",
        },
      },
      completed: { type: "final" },
    },
  };

  await client.runWorkflow(workflow, {
    handlers: {
      "menu.create": ({ input, ok }) => ok({ menuId: `menu:${input.name}` }),
    },
    onEvent: (event) => events.push(event),
  });

  assertEquals(events.map((event) => event.type), [
    "workflow.started",
    "tool.started",
    "tool.completed",
    "workflow.completed",
  ]);
  assertEquals(events[0], { type: "workflow.started", workflowId: "create-menu" });
  assertEquals(events[1], {
    type: "tool.started",
    workflowId: "create-menu",
    state: "createMenu",
    tool: "menu.create",
    input: { name: "Dinner" },
  });
  assertEquals(events[2], {
    type: "tool.completed",
    workflowId: "create-menu",
    state: "createMenu",
    tool: "menu.create",
    output: { ok: true, data: { menuId: "menu:Dinner" } },
  });
  assertEquals(events[3], {
    type: "workflow.completed",
    workflowId: "create-menu",
    finalState: "completed",
  });
});
