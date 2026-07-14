---
"gruntend-sdk": minor
---

Add first-class generated UI renderers so applications explicitly choose how a compiled generated-UI frame is committed to its target.

- Export renderer and session contracts from `gruntend-sdk/renderer`.
- Add the built-in DOMPurify renderer at `gruntend-sdk/renderer/dom-purify` with an exact markup policy and direct `DocumentFragment` commits.
- Route Svelte, React, Vue, and Solid adapters through the selected renderer and add shared render and action lifecycle callbacks.
- Add renderer conformance, sanitization, event delegation, and lifecycle coverage.

Framework adapters now require a `renderer` prop. Create a renderer once for the mounted component lifetime and pass it alongside the `GeneratedUi` value. DOMPurify is the only built-in browser renderer; applications can implement the renderer interface for other targets or commit strategies.
