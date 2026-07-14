# Generated UI architecture

Generated UI is one domain with three small responsibilities:

```text
src/ui/
  compiler.ts
  policy.ts
  renderer.ts
  renderers/
    dom-session.ts
    dom-purify.ts
  react/ · solid/ · svelte/ · vue/
  index.ts
```

## Compiler

`compiler.ts` captures `html` tagged templates as strings and values, classifies each interpolation, escapes text and attributes, converts event functions into delegated handler identifiers, and validates the resulting tags and attributes against `policy.ts`.

The compiler returns a `GeneratedUiFrame` containing inert HTML and the handler closures referenced by that HTML. It does not access the browser DOM.

## Renderer contract

`renderer.ts` defines `GeneratedUiRenderer<TTarget>` and `GeneratedUiRenderSession`. Applications select a renderer when mounting a generated UI. The renderer remains fixed for that session while `session.update(nextUi)` changes the generated UI value.

The interface is the extension point for non-DOM targets or application-specific commit strategies. Gruntend does not infer or allow generated code to select a renderer.

## Browser renderer

`renderers/dom-purify.ts` is the only built-in browser renderer. It sanitizes the compiled frame with the shared generated-UI policy, receives a `DocumentFragment`, and commits that fragment with `replaceChildren()`.

`renderers/dom-session.ts` contains the browser lifecycle shared by that renderer: delegated events, restricted event payloads, handler execution, rerendering, stale-action protection, updates, and cleanup.

There is no built-in direct-`innerHTML` renderer and no legacy mounting shortcut. Applications that deliberately need a different strategy implement `GeneratedUiRenderer<TTarget>` explicitly.

## Boundaries

These boundaries solve different problems:

| Boundary | Responsibility |
| --- | --- |
| TypeScript renderer types | Match renderers with valid host targets |
| UI compiler and policy | Reject unsafe template structure and encode handler closures |
| DOMPurify renderer | Sanitize the final browser markup before insertion |
| Code-plan executor | Evaluate generated JavaScript with the selected trust profile |
| Tool handlers | Enforce permissions, persistence rules, and application authority |

Renderer typing is not a security boundary at runtime. DOMPurify does not sandbox generated JavaScript, and executor isolation does not authorize tool calls.
