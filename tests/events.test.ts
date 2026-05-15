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

Deno.test("runWorkflow emits retry events when a retryable tool error will be retried", async () => {
  const events: WorkflowRuntimeEvent[] = [];
  const createMenu = defineTool({
    name: "menu.create",
    description: "Create a menu.",
    input: v.object({ name: v.string() }),
    output: v.object({ menuId: v.string() }),
  });
  const client = createGenOpenClient({ tools: [createMenu] });
  const workflow: WorkflowMachineConfig = {
    id: "create-menu-retry",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.create",
            params: { name: "Dinner" },
            retry: { maxAttempts: 2 },
          },
          onDone: "completed",
          onError: "failed",
        },
      },
      completed: { type: "final" },
      failed: { type: "final" },
    },
  };

  await client.runWorkflow(workflow, {
    handlers: {
      "menu.create": ({ input, ok, err, attempt }) => {
        if (attempt === 1) {
          return err({
            code: "TEMPORARY_FAILURE",
            message: "Temporary menu API failure.",
            retryable: true,
          });
        }

        return ok({ menuId: `menu:${input.name}` });
      },
    },
    onEvent: (event) => events.push(event),
  });

  assertEquals(events.map((event) => event.type), [
    "workflow.started",
    "tool.started",
    "tool.retrying",
    "tool.started",
    "tool.completed",
    "workflow.completed",
  ]);
  assertEquals(events[2], {
    type: "tool.retrying",
    workflowId: "create-menu-retry",
    state: "createMenu",
    tool: "menu.create",
    attempt: 1,
    maxAttempts: 2,
    nextAttempt: 2,
    error: {
      type: "handler_error",
      state: "createMenu",
      tool: "menu.create",
      message: "Temporary menu API failure.",
      code: "TEMPORARY_FAILURE",
      retryable: true,
    },
  });
});
