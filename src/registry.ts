import type { Tool } from "./tool.ts";

export interface ToolRegistry<TTool extends Tool = Tool> {
  tools(): readonly TTool[];
  get(name: string): TTool | undefined;
}

export function createToolRegistry<const TTools extends readonly Tool[]>(
  tools: TTools = [] as unknown as TTools,
): ToolRegistry<TTools[number]> {
  const byName = new Map<string, TTools[number]>();

  for (const tool of tools) {
    if (byName.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }

    byName.set(tool.name, tool);
  }

  return {
    tools() {
      return tools.slice();
    },
    get(name: string) {
      return byName.get(name);
    },
  };
}
