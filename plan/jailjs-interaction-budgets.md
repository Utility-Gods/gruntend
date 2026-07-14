# First-class browser code-plan executor surface

## Context

`CodePlanExecutor` exists today as an optional function, but JailJS is still imported and instantiated as an implicit singleton default inside `src/code-plan.ts`. That makes JailJS part of the core runtime instead of one selectable implementation, and it makes a future browser executor such as QuickJS look like an exception rather than an equal plug-in.

This phase is intentionally browser-focused and narrow. JailJS currently runs in the browser context, so the goal is to extract a stable executor surface and prove it with two browser implementations: the existing controlled JailJS executor and an isolated in-page QuickJS/WASM executor. This phase does **not** add Node.js support, Workers, transports, RPC/message protocols, remote execution, or asynchronous generated-UI sessions.

Before implementing the surface, revert only the recent private-`opCount` JailJS wrapper experiment, its added UI budget tests, and its fresh-budget documentation. Restore the demo's temporary `restaurantPlanMaxOps = 500_000` override and the host-canary regression. Preserve unrelated quoted-attribute, responsive-demo, model/cache/usage, prompt, and documentation work already in the tree.

## Approach

Promote executors to explicit object-based strategies while retaining the current browser-local execution context and generated-UI behavior:

```ts
interface CodePlanExecutor {
  readonly profile: CodePlanExecutorProfile;
  execute(context: CodePlanExecutorContext): Promise<unknown> | unknown;
}
```

The profile contains a stable executor ID, a controlled/isolated trust label, and whether the executor supports the current generated-UI contract. It is descriptive and used for preflight checks; it is not proof of security.

Keep `CodePlanExecutorContext` small and close to the current working API: `code`, Gruntend-created `globals`, `maxOps`, and `signal`. The executor owns how those values are represented in its interpreter. JailJS injects them directly for controlled plans. QuickJS copies supported input/result values and creates guest-owned tool, console, Promise, and `html` functions through its in-page FFI; no raw host function, object, prototype, or QuickJS handle becomes guest-visible. This is a direct same-thread bridge, not a transport or message protocol.

Require an executor for direct `runCodePlan()` calls and at `createGruntendClient()` construction. Preserve the explicit per-run override so one browser application can mix executors across separate plans. Composition is whole-plan selection, never statement-level dispatch: `runOptions.executor ?? client.executor` is chosen once, and that executor owns the initial code, every Promise continuation, render closure, and event handler for the resulting session. Generated code and individual statements never select executors. If the selected executor is unavailable, does not support requested UI, throws, or aborts, return one failure; never invoke another executor, retry the whole plan, or downgrade to JailJS. Existing retries remain limited to individual validated tool calls.

Move JailJS into its own executor module and explicit package export. Preserve its ES5 transform, operation budget, dotted tools, synchronous generated-UI closures, and current behavior. Label it controlled-only. Do not patch reflection, access private interpreter state, or claim that it isolates adversarial code.

Add `createQuickJsBrowserCodePlanExecutor()` using `quickjs-emscripten-core` and the minimal release-sync browser variant. Load WASM asynchronously when creating the executor, then create a fresh QuickJS runtime/context per plan. Implement guest-owned dotted tool aliases with deferred guest promises, deterministic pending-job draining, copied plain values, normalized exceptions, console forwarding, memory/stack/deadline limits, and complete handle disposal. Because this phase is same-thread browser execution, no Worker or message transport is involved.

Preserve the current synchronous generated-UI rendering contract. Define guest-native `html` template records, retain guest render/event functions behind host callable wrappers, and compile decoded records with the existing safe compiler. Add only synchronous idempotent `destroy()` ownership so QuickJS UI sessions can release retained handles/runtime memory; the existing DOM controller calls it on replacement/unmount. More advanced asynchronous/Worker-backed UI sessions remain deferred.

## Non-goals for this phase

- No Node.js executor or Node-specific API.
- No Web Worker, worker thread, child process, iframe, or remote executor implementation.
- No transport, message protocol, RPC layer, or cross-thread codec.
- No asynchronous generated-UI/session/controller migration.
- No framework-adapter API redesign; adapters only inherit synchronous disposal through the shared DOM controller.
- No automatic environment detection, routing, executor fallback, or whole-plan replay.
- No private JailJS patch and no new security claim for JailJS.

## Files to modify

- `src/executor.ts` — first-class executor, profile, trust label, generated-UI support, context, and normalized executor error contracts.
- `src/code-plan.ts` — remove the implicit JailJS singleton/import, require one selected executor, perform profile preflight, and preserve the existing tool/global/result behavior.
- `src/client.ts` — require a client executor and retain explicit per-run override.
- `src/executors/jailjs.ts` — move the current JailJS implementation unchanged behind the object-based contract.
- `src/executors/quickjs-browser.ts` — in-page QuickJS module/runtime lifecycle, copied value bridge, deferred tool promises, guest templates/closures, limits, and disposal.
- `package.json` and build configuration — add explicit `./executor`, `./executor/jailjs`, and `./executor/quickjs-browser` exports plus pinned minimal QuickJS dependencies.
- `tests/executor-conformance.ts`, `tests/executor-jailjs.test.ts`, and `tests/executor-quickjs-browser.test.ts` — explicitly parameterized shared browser behavior, JailJS controlled-mode coverage, and QuickJS isolation/lifecycle coverage.
- `tests/code-plan.test.ts` and `tests/client.test.ts` — explicit selection, profiles, mixing, preflight, structured failures, and no fallback.
- `src/ui-runtime.ts`, `src/ui/index.ts`, and `src/ui/dom.ts` plus existing UI tests — add synchronous idempotent disposal while preserving rendering/action semantics.
- `examples/sveltekit/src/routes/+page.svelte` and client setup — default to explicit JailJS, retain its `500_000` allowance, and offer lazy per-run QuickJS selection in the browser demo.
- `README.md`, `PHILOSOPHY.md`, and website executor/API guides — first-class executor selection, mixing, strict failure, browser focus, and the JailJS/QuickJS trust matrix.
- `.changeset/<first-class-browser-executors>.md` — pre-1.0 minor migration for required explicit executor selection.

## Reuse

- Preserve `runCodePlan()` and `createGruntendClient()` as the application entry points.
- Preserve `CodePlanExecutorContext`'s current `code`, `globals`, `maxOps`, and `signal` concepts.
- Reuse `createToolsObject()`, `executeToolCall()`, schema validation, retries, `ok`/`err`, authorization, console handling, and lifecycle events unchanged.
- Preserve `createUiComponent()`, `createGeneratedUi()`, `compileUiTemplate()`, DOM mounting, restricted HTML/SVG, and framework adapter APIs; extend only shared cleanup ownership.
- Preserve the current JailJS transform/evaluate implementation after moving it out of core.
- Reuse the current safe template compiler after QuickJS template records are decoded on the host.
- Parameterize conformance by an explicit executor instance supplied by each test file; the suite never chooses or composes executors itself.

## Steps

- [x] Revert the private-`opCount` wrapper, its two UI budget tests, and fresh-budget documentation; restore the demo's `500_000` JailJS allowance and the host-canary fixture. Remove the superseded JailJS-budget plan claims without reverting unrelated work.
- [x] Add `src/executor.ts` with an object-based `CodePlanExecutor`, stable profile ID, `controlled | isolated` trust label, generated-UI support flag, the existing execution context fields, and normalized executor error codes.
- [x] Refactor `runCodePlan()` to require exactly one executor, preflight generated-UI support from its profile, call only `executor.execute()`, and normalize unsupported/aborted/thrown failures into the existing result and lifecycle stream.
- [x] Refactor `createGruntendClient()` so its executor is required while retaining an explicit per-run override. Do not add routing or fallback logic.
- [x] Move JailJS into `src/executors/jailjs.ts`, export `createJailJsCodePlanExecutor()`, mark its profile controlled-only with generated-UI support, and preserve its current ES5 transform, globals, and `maxOps` behavior without private-state access.
- [x] Implement `createQuickJsBrowserCodePlanExecutor()` with the minimal release-sync variant: asynchronous WASM initialization, fresh runtime/context per plan, copied plain values, guest-owned globals/dotted tools, deferred promises, pending-job draining, normalized errors, console forwarding, limits, and exhaustive temporary-handle disposal.
- [x] Implement QuickJS-native `html` records and retained render/event handles behind the existing synchronous callable UI shape. Decode only supported template values, compile on the host, and add idempotent `destroy()` so UI replacement/unmount disposes all QuickJS handles and runtime memory.
- [x] Add a reusable conformance function that receives one executor instance explicitly, for example `runExecutorConformance("jailjs", jailJs)` and `runExecutorConformance("quickjs-browser", quickJs)`. It runs browser-local data results, async tools, `Promise.all`, dotted tools, validation, expected errors, thrown faults, console events, abort, static templates, closure-backed UI, cleanup, and implementation-appropriate limits. It never assigns statements to different executors.
- [x] Add strict selection/mixing tests: client default, per-run override, different sequential and concurrent executors, unsupported UI preflight, executor initialization/execution failure, abort, and failure after a successful tool mutation. Assert no second executor runs and no effect is replayed.
- [x] Restore the host-`Function` exploit as an isolation fixture and keep JailJS explicitly outside that suite. Test that JailJS reports `controlled`; run the unchanged exploit plus ambient `globalThis`, `window`, `document`, `fetch`, storage, and prototype/reflection checks against QuickJS and require them to resolve only inside the guest or be unavailable.
- [x] Add explicit package exports and update all SDK tests, examples, and direct `runCodePlan()` calls to select an executor. Default the SvelteKit demo to explicit JailJS with `restaurantPlanMaxOps = 500_000`, and lazily initialize QuickJS when the user selects it for a run.
- [x] Document the browser executor surface, custom implementation example, mixing rules, strict no-fallback behavior, and JailJS/QuickJS trust matrix. State that Node, Workers, transports, and async UI sessions are deferred implementation work rather than part of this release.
- [x] Add a separate minor changeset describing the required explicit executor migration; do not combine it with the pending quoted-interpolation patch.

## Verification

The user must run package-manager commands because repository instructions prohibit the assistant from doing so:

- Focused executor, client, code-plan, and existing UI tests.
- Full test suite, typecheck, formatting check, SDK build, and package dry run.
- SvelteKit check/build and documentation-site build.
- Consumer fixture imports for `gruntend-sdk/executor` and `gruntend-sdk/executor/jailjs`.
- Browser demo verification with both explicit JailJS and QuickJS selection for initial plans, async tools, `Promise.all`, static UI, closure state, repeated interactions, confirmed mutations, and operation-limit reporting.
- Failure injection proving unsupported UI, abort, executor errors, and post-mutation failures emit one failure and never invoke another executor or replay the plan.
- Confirm the QuickJS browser export works in a browser build while no Worker, Node, transport/protocol, or async-adapter implementation enters this release; verify retained QuickJS UI resources are released on destroy.
