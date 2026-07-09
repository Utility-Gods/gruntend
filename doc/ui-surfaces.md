# Gruntend Tagged HTML UI Runtime

This note captures the current generated UI direction.

## Goal

Let an LLM produce useful UI without inventing a JSON UI DSL or asking it to generate JSX.

The LLM still returns the same Gruntend code plan shape:

```json
{
  "summary": "short summary",
  "input": {},
  "code": "plain JavaScript async function body"
}
```

Inside that JavaScript, UI is expressed with one primitive:

```js
html`...`
```

`html` is a standard JavaScript tagged template function injected by the runtime. It returns a structured template object, not a browser DOM node and not a trusted raw HTML string.

## Component Contract

For simple UI, the generated code can return an `html` template directly:

```js
return html`<p>Hello ${input.name}</p>`;
```

For local state, the generated code returns a render function:

```js
var count = 0;

return function render() {
  return html`
    <button type="button" onclick=${function () {
      count = count + 1;
    }}>
      Count: ${count}
    </button>
  `;
};
```

The host treats a returned function as the component's render function. The function is kept inside the interpreter boundary, so its closed-over state stays private to that generated component instance.

## Runtime Flow

```text
LLM returns plain JavaScript code
  -> jailjs runs the code with injected input/tools/parallel/console/html
  -> code returns html`...` or function render() { return html`...`; }
  -> host compiles the template
  -> text and attribute interpolations are escaped
  -> function-valued event slots become inert data-gr-* handler ids
  -> host renders safe HTML
  -> event dispatch calls the captured interpreted closure
  -> host calls render again
```

Generated code does not receive `window`, `document`, `fetch`, storage, timers, `eval`, or `Function` by default.

## Menu Page Example

This is the kind of generated JavaScript we want the runtime to support:

```js
var selected = [];

function toggle(itemId) {
  var index = selected.indexOf(itemId);

  if (index === -1) {
    selected.push(itemId);
    return;
  }

  selected.splice(index, 1);
}

return function render() {
  return html`
    <section>
      <h2>${input.menuName}</h2>
      <p>${selected.length} selected</p>

      <div>
        ${input.items.map(function (item) {
          return html`
            <button type="button" onclick=${function () {
              toggle(item.itemId);
            }}>
              ${item.name}
            </button>
          `;
        })}
      </div>
    </section>
  `;
};
```

The rendered DOM never receives `onclick`. The compiler rewrites function-valued events:

```html
<button type="button" data-gr-click="h0">Truffle Fries</button>
```

The component instance keeps:

```text
h0 -> interpreted closure
```

Clicking calls the closure, mutates `selected`, and the host rerenders the component.

## Safety Rules

Tagged templates help because static markup and dynamic values stay separate:

```js
html`<p>${userInput}</p>`
```

The host receives:

```text
strings = ["<p>", "</p>"]
values = [userInput]
```

That separation lets the compiler enforce these rules:

- Escape text interpolations.
- Escape attribute interpolations.
- Reject interpolations that alter tag or attribute structure.
- Reject static event attributes such as `onclick="evil()"`.
- Allow event handlers only as function interpolation slots such as `onclick=${handler}`.
- Rewrite allowed events to inert `data-gr-*` attributes.
- Reject unsafe tags such as `script`, `iframe`, `object`, `embed`, `link`, `style`, and `meta`.
- Drop unknown attributes by default.
- Keep handler closures in memory, never in DOM attributes.

The syntax alone is not the safety boundary. The host compiler is.

## Non-Goals For V0

- No JSX.
- No React-compatible runtime.
- No virtual DOM framework.
- No hooks.
- No browser-side execution of generated JavaScript.
- No large layout DSL.

The v0 runtime is just:

```text
plain generated JS + html tagged templates + strict compiler + handler table
```

## Relation To Hypermedia

The earlier hypermedia prototype remains useful for semantic app actions and forms, but it is not the main generated component model.

For local component state, dynamic selection counts, previews, filters, and staged actions, tagged `html` is the primary direction.
