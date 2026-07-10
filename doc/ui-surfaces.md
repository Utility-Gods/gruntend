# Gruntend UI Surfaces

This note captures the current understanding of Gruntend's generated UI direction after comparing the hypermedia prototype with the stateful `html` tagged-template runtime idea.

## Goal

Let an LLM/runtime produce useful UI without inventing a JSON UI DSL.

The UI layer should stay close to normal web primitives:

- JavaScript for logic and local state when needed.
- HTML for layout and controls.
- App-owned tools/actions for real effects.
- Host-side compilation/hydration for safety.

## Two complementary surfaces

### 1. Hypermedia surface

The current prototype returns HTML strings with semantic action attributes:

```html
<button type="button" gr-href="/menus/menu_1/items/item_2/actions/delete">
  Delete
</button>
```

The host hydrates the surface:

```ts
hydrateHtmlSurface(root, {
  submitAction(actionId, submission) {
    // route semantic action to app-owned behavior
  },
});
```

Use this for:

- navigation
- app-owned actions
- forms
- approvals
- tool-backed mutations
- simple result cards and action menus

Strengths:

- very small runtime
- easy to inspect
- no generated UI JavaScript
- actions are semantic paths owned by the app
- good mock/demo story

Limits:

- no local component state beyond native browser form state
- awkward for rich interactions such as dynamic selection counts, filters, previews, local sorting, select-all behavior
- generated code often string-builds HTML manually unless paired with helper functions

### 2. Stateful UI runtime surface

For richer local UI, use native JavaScript plus an `html` tagged template:

```js
const state = { selected: [] };

function toggle(id) {
  const index = state.selected.indexOf(id);
  if (index === -1) state.selected.push(id);
  else state.selected.splice(index, 1);
}

function render() {
  return html`
    <section>
      <p>${state.selected.length} selected</p>
      <button onclick=${() => toggle("item_1")}>Toggle item</button>
    </section>
  `;
}

return { render };
```

The browser must not receive real inline JavaScript. The compiler rewrites event function slots to inert delegated bindings:

```html
<button data-gr-click="h0">Toggle item</button>
```

The host keeps:

```ts
h0 -> sandboxed function
```

Use this for:

- multi-select before mutation
- filtering/sorting
- local previews
- staged batch operations
- richer generated components

Strengths:

- native JS semantics
- no custom template DSL
- local component state
- composable functions/components

Limits:

- needs a JS interpreter/sandbox boundary
- needs an HTML compiler/sanitizer
- larger runtime than hypermedia
- generated UI tools/actions need a capability membrane

## Multi-select example

Question: can the hypermedia prototype support selecting two rows and deleting them?

Answer: partially.

With native form state, yes:

```html
<form gr-href="/menus/menu_1/items/actions/delete-selected">
  <label><input type="checkbox" name="itemId" value="item_1"> Fries</label>
  <label><input type="checkbox" name="itemId" value="item_2"> Soup</label>
  <button type="submit">Delete selected</button>
</form>
```

This is enough when the browser's form state is the only state needed.

But for dynamic local behavior like this:

```text
select item A
select item B
show "2 selected"
preview affected rows
click delete selected
```

hypermedia alone is not enough unless each click round-trips through an app/session action. The stateful UI runtime is the better fit.

## Recommended architecture

Keep both surfaces, with separate responsibilities:

```text
Hypermedia surface
  HTML + gr-href/forms
  app-owned semantic actions
  minimal hydration

Stateful UI runtime
  JS + html tagged template
  local state
  delegated events
  explicit action/tool membrane
```

They can compose later. A stateful component can stage local selection and then call an app-owned action:

```js
async function deleteSelected() {
  await actions.submit("/menus/menu_1/items/actions/delete-selected", {
    itemIds: state.selected,
  });
}
```

## Safety model

### Hypermedia

- Treat generated HTML as untrusted.
- Allow only safe tags/attributes.
- Hydrate only known semantic attributes such as `gr-href`.
- Route action IDs through app-owned handlers/code plans.
- Prefer forms for structured submissions.

### Stateful UI runtime

- Run generated JS in an interpreter/sandbox.
- Do not expose `window`, `document`, `fetch`, `localStorage`, `eval`, `Function`, `WebSocket`, or `XMLHttpRequest`.
- `html` returns a template object, not raw DOM.
- Parse/compile rendered HTML before insertion.
- Reject unsafe tags and attributes.
- Reject static event handlers such as `onclick="alert(1)"`.
- Allow event binding only through function interpolation, e.g. `onclick=${handler}`.
- Rewrite events to inert `data-gr-*` attributes.
- Reject interpolation that changes tag or attribute structure, including `<bu${"tton"}>`.

## Decision table

| Need | Hypermedia surface | Stateful UI runtime |
| --- | --- | --- |
| Show action cards | Good | Works, but heavier |
| Navigate/open app pages | Good | Works via injected actions |
| Submit a simple form | Good | Works, but heavier |
| Select multiple checkboxes and submit | Good if native form state is enough | Good |
| Dynamic selected count | Awkward | Good |
| Local filtering/sorting | Awkward | Good |
| Batch preview before action | Awkward | Good |
| Minimal safe demo | Good | More moving parts |
| Component-local state | No | Yes |

## Current recommendation

Use the hypermedia prototype as the current SvelteKit demo foundation because it is simple and product-visible.

Add the stateful UI runtime as a separate capability, not a replacement, when we need local generated component state.

Suggested public shape over time:

```text
gruntend/hypermedia
  hydrateHtmlSurface(...)
  materializeHtmlSurface(...)
  matchSemanticActionPath(...)

gruntend/ui-runtime
  createUiComponent(...)
```

The key distinction:

```text
Hypermedia = app actions over safe HTML.
UI runtime = local stateful generated components.
```
