---
name: domain-driven-design
description: Domain-driven design rules for GenOpen SDK development. Use when adding or changing foundational types, registries, manifests, workflow decoding, or runtime execution.
---

# Domain Driven Design

Use DDD to keep the SDK small, explicit, and mature.

## Core Direction

Build from the smallest domain primitive outward:

```text
Tool
↓
ToolRegistry
↓
Manifest emitter
↓
Workflow decoder
↓
Runtime executor
```

Do not introduce a layer until a test requires it.

## Rules

- Keep the public API thin and object-based.
- Use plain data contracts first; adapters/wrappers come later.
- Separate domain contracts from runtime concerns.
- A tool definition describes a contract and has an executor.
- A manifest is model-facing JSON and must not include executable functions.
- A registry collects tools and emits manifests; it should not execute workflows.
- Workflow decoding and runtime execution are later domains, not part of the base tool contract.
- Avoid lifecycle, UI, approval, read/write policy, and agent-loop concepts until they are explicitly needed.

## Package Layout

```text
src/
  tool.ts        # Tool types, defineTool
  registry.ts    # Tool registry when needed
  manifest.ts    # Manifest types/emission when needed
  mod.ts         # Public exports if source-level barrel is needed

tests/
  tool.test.ts
  registry.test.ts
  manifest.test.ts

examples/        # Later: small app/workflow examples
```

Root `mod.ts` exports public API from `src/`.

## Design Preference

Prefer this:

```ts
const createMenu = defineTool({
  name: "menu.create",
  description: "Create a menu",
  input: CreateMenuInput,
  output: CreateMenuOutput,
  execution: "sequential",
  execute: async ({ input }) => ({ data: { menuId: "menu_1" } }),
});
```

Avoid premature fluent APIs, inheritance trees, and framework-like abstractions.
