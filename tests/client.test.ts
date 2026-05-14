import { assertEquals } from "@std/assert";
import {
  createGenOpenClient,
  defineTool,
  type WorkflowMachineConfig,
} from "../mod.ts";
import * as v from "valibot";

Deno.test("GenOpen client runs an LLM workflow response with runtime closure handlers", async () => {
  let receivedAuthToken = "";

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

  const authToken = "secret-token";
  const llmResponse: WorkflowMachineConfig = {
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
        },
      },
      completed: {
        type: "final",
      },
    },
  };

  const result = await client.runWorkflow(llmResponse, {
    handlers: {
      "menu.create": ({ input }) => {
        receivedAuthToken = authToken;

        return {
          data: {
            menuId: `menu:${input.name}`,
          },
        };
      },
    },
  });

  assertEquals(receivedAuthToken, "secret-token");
  assertEquals(result, {
    status: "done",
    outputs: {
      createMenu: {
        data: {
          menuId: "menu:Dinner",
        },
      },
    },
    errors: {},
    finalState: "completed",
  });
});
