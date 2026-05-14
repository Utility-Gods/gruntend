import type { WorkflowMachineConfig } from "../../../mod.ts";

export interface MenuRequestData {
  readonly menuName: string;
  readonly items: readonly MenuItemData[];
}

export interface MenuItemData {
  readonly name: string;
  readonly price: number;
}

export async function generateMenuWorkflow(data: MenuRequestData): Promise<WorkflowMachineConfig> {
  const itemStates = Object.fromEntries(
    data.items.map((item, index) => {
      const stateName = `createItem${index + 1}`;

      return [
        stateName,
        {
          initial: "run",
          states: {
            run: {
              invoke: {
                src: "tool" as const,
                input: {
                  tool: "menu.item.create",
                  params: {
                    menuId: { $ref: "createMenu.data.menuId" },
                    name: item.name,
                    price: item.price,
                  },
                  retry: {
                    maxAttempts: 2,
                  },
                },
                onDone: "done",
                onError: "failed",
              },
            },
            done: {
              type: "final" as const,
            },
            failed: {
              type: "final" as const,
            },
          },
        },
      ];
    }),
  );

  return {
    id: "create-menu-from-data",
    initial: "createMenu",
    states: {
      createMenu: {
        invoke: {
          src: "tool",
          input: {
            tool: "menu.create",
            params: {
              name: data.menuName,
            },
          },
          onDone: "createItems",
          onError: "failed",
        },
      },
      createItems: {
        type: "parallel",
        states: itemStates,
        onDone: "completed",
      },
      completed: {
        type: "final",
      },
      failed: {
        type: "final",
      },
    },
  };
}
