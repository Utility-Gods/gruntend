import { assertEquals } from "@std/assert";
import {
  createGenOpenClient,
  defineTool,
  type WorkflowMachineConfig,
} from "../mod.ts";
import * as v from "valibot";

interface AppContext {
  readonly authToken: string;
}

Deno.test("GenOpen client runs an LLM workflow response against registered tools with app context", async () => {
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
    execute({ input, context }) {
      receivedAuthToken = (context as AppContext).authToken;

      return {
        data: {
          menuId: `menu:${input.name}`,
        },
      };
    },
  });

  const client = createGenOpenClient({
    tools: [createMenu],
    context: {
      authToken: "secret-token",
    } satisfies AppContext,
  });

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

  const result = await client.runWorkflow(llmResponse);

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
    finalState: "completed",
  });
});
