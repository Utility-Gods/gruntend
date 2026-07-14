---
"gruntend-sdk": minor
---

Make code-plan execution an explicit, first-class application choice.

### Migration

- Pass an object-based `CodePlanExecutor` to every direct `runCodePlan()` call and every `createGruntendClient()` call.
- Preserve current behavior by importing `createJailJsCodePlanExecutor()` from `gruntend-sdk/executor/jailjs` and passing its result as `executor`.
- Override the client executor for an individual plan with the existing per-run `executor` option.

### First-class browser executors

- Add stable executor profiles with an ID, a `controlled` or `isolated` trust label, and a generated-UI capability declaration.
- Export the executor contract from `gruntend-sdk/executor`.
- Export explicit JailJS and QuickJS strategies from `gruntend-sdk/executor/jailjs` and `gruntend-sdk/executor/quickjs-browser`.
- Keep JailJS as the lightweight `controlled` executor with its ES5 transformation, dotted tools, generated UI, and `maxOps` operation budget. JailJS is not presented as a hostile-code isolation boundary.
- Add an asynchronously initialized `quickjs-browser` executor backed by the original QuickJS engine compiled to WebAssembly. It creates a fresh runtime and context for every plan, copies supported values rather than exposing host objects, bridges asynchronous tools through guest-owned promises, forwards console events, and enforces memory, stack, and deadline limits.

### Strict selection and failure behavior

- Pin the initial plan, Promise continuations, render closure, and event closures to exactly one selected executor.
- Normalize initialization, unsupported-UI, abort, and execution failures.
- Never automatically fall back, downgrade, or replay a complete plan through a second executor. This prevents completed effects from being repeated after a later failure.

### Generated UI lifecycle

- Represent QuickJS templates and retained closures as guest-owned values behind the existing synchronous generated-UI contract.
- Add idempotent generated-UI cleanup so replacement and unmount release retained QuickJS functions, context handles, and runtime memory.

### Demo and verification

- Add shared JailJS and QuickJS conformance coverage for data, asynchronous tools, `Promise.all`, dotted tools, validation, expected failures, unexpected faults, console events, aborts, templates, closure state, cleanup, and limits.
- Add strict executor-selection, no-replay, lifecycle, and host-isolation tests.
- Let the SvelteKit restaurant demo choose JailJS or lazily initialized QuickJS/WASM for each complete plan.
