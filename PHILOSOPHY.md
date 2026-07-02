# Gruntend Philosophy

We believe the next generation of applications will not be built only around static interfaces, but around semantic capabilities that intelligent systems can understand, orchestrate, and project dynamically.

Most current “Generative UI” systems focus on letting LLMs generate isolated UI components inside conversational environments. While useful, these systems often treat the application itself as secondary.

Our direction is different.

We are not trying to build a chatbot that renders forms.

We are exploring a semantic runtime layer for applications.

Modern applications already contain rich semantic structure:

- forms
- validation schemas
- actions
- API contracts
- permissions
- workflows
- routes
- mutations
- components
- business logic

Today, these capabilities are fragmented across frontend and backend systems and are primarily designed for humans to navigate manually.

We believe applications should instead expose capabilities in a structured, introspectable way so intelligent runtimes can reason over them.

In this model, AI does not generate arbitrary UI or call arbitrary application internals.

Instead, applications expose:

- available actions
- typed inputs and outputs
- domain entities
- permissions and constraints
- safe runtime handlers
- eventually, UI projections

The AI layer becomes an orchestrator over existing application semantics.

For example, instead of merely generating a generic form, an intelligent runtime inside a restaurant management system could:

- discover menu management capabilities
- list menu items through an approved tool
- find or create a destination menu
- copy items with validation and retries
- execute mutations safely through app-owned handlers
- project an execution trace back to the user

This shifts the role of AI from “renderer” to “semantic coordinator”.

We believe this is a more robust direction because:

- the application remains authoritative
- permissions stay enforceable
- validation remains deterministic
- app internals stay private
- workflows become adaptive
- applications become queryable by intent instead of navigation alone

## Why code plans?

Earlier designs used declarative workflow JSON. That works for simple linear flows, but it becomes awkward for runtime-derived behavior:

- conditionals
- loops
- dynamic fan-out
- early returns
- filtering
- branching based on prior results

Those are not edge cases. They are ordinary application logic.

Gruntend treats LLM-generated code as a plan format, not trusted app code. The code can compose capabilities with normal language constructs, but it can only call registered tools.

```ts
const existing = await tools.menu.find({ name: input.name });

if (existing.exists) {
  return { action: "reused", menuId: existing.menuId };
}

const created = await tools.menu.create({ name: input.name });
return { action: "created", menuId: created.menuId };
```

The generated plan is expressive, but the authority boundary remains the tool registry and app-owned handlers.

## Core belief

The system is not:

```text
AI generates frontend
```

The system is:

```text
Applications expose semantic capabilities
↓
LLM generates orchestration logic
↓
Runtime validates and executes through approved tools
↓
UI projects execution state
```

So the real product is:

```text
A semantic application runtime for agents
```
