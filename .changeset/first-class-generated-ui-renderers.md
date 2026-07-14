---
"gruntend-sdk": minor
---

Add first-class generated UI renderers so applications explicitly choose how a compiled generated-UI frame is committed to its target.

- Export renderer and session contracts from `gruntend-sdk/renderer`.
- Add a recommended DOMPurify renderer at `gruntend-sdk/renderer/dom-purify` with an exact markup policy and direct `DocumentFragment` commits.
- Add the compiled DOM renderer at `gruntend-sdk/renderer/dom` for controlled integrations.
- Route Svelte, React, Vue, and Solid adapters through the selected renderer and add shared render and action lifecycle callbacks.
- Add renderer conformance, sanitization, event delegation, and lifecycle coverage.

Framework adapters now require a `renderer` prop. Create a renderer once for the mounted component lifetime and pass it alongside the `GeneratedUi` value. The compatibility `mountGeneratedUi()` helper remains available from `gruntend-sdk/ui/dom`.
