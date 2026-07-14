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

A planner can become an orchestrator over existing application semantics. That planner may be a model, application code, a stored plan, or a human-authored program.

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

Gruntend treats JavaScript as a plan format, not trusted app code. A model may generate the plan, but plans may also be authored, stored, reviewed, or produced by another system. The code can compose capabilities with normal language constructs, but it can only call registered tools.

```ts
const existing = await tools.menu.find({ name: input.name });

if (existing.exists) {
  return { action: "reused", menuId: existing.menuId };
}

const created = await tools.menu.create({ name: input.name });
return { action: "created", menuId: created.menuId };
```

The plan is expressive, but the authority boundary remains the tool registry and app-owned handlers.

## Where Gruntend starts

Plan generation is optional and application-owned. Gruntend can provide model-facing manifests, a default prompt, response parsing, and provider integrations, but it does not guarantee that a model will produce the correct plan.

The runtime contract starts when code is supplied:

```text
code + input + registered tools + app-owned handlers
→ controlled execution
→ validated tool calls
→ result or explicit failure
```

Applications own model choice, prompts, examples, evaluation, and whether generated code should be reviewed before execution.

## Why an interpreter?

A code plan is not passed to `eval` or `Function`. Gruntend executes it through a `CodePlanExecutor` with only explicit globals: `input`, registered `tools`, safe `console`, and optional `html`.

Executor selection is explicit. JailJS is the pinned lightweight `controlled` executor and is not a security sandbox. The QuickJS/WASM browser executor runs plans in a separate JavaScript realm and heap and reports `isolated`. Neither executor is the product's authority boundary: the tool registry, validation, and application-owned handlers remain responsible for effects. Each plan and its closures stay pinned to one selected executor, with no fallback or whole-plan replay.

## Core belief

The system is not:

```text
AI generates frontend
```

The system is:

```text
Applications expose semantic capabilities
↓
A planner supplies JavaScript orchestration logic
↓
A controlled executor interprets the plan
↓
Runtime validates calls through approved tools and handlers
↓
The plan returns data or optional task-specific UI
```

So the real product is:

```text
A semantic application runtime
```
