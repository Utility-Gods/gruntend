import type { Tool } from "./tool.ts";

export interface ToolRegistry<TTool extends Tool = Tool> {
  tools(): readonly TTool[];
  get(name: string): TTool | undefined;
}

export function createToolRegistry<const TTool extends Tool>(
  tools: readonly TTool[] = [],
): ToolRegistry<TTool> {
  const byName = new Map<string, TTool>();

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
