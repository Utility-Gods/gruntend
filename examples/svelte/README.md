# GenOpen Svelte Example

Reference frontend app that imports the SDK and defines a small set of async tools.

Run:

```bash
cd examples/svelte
deno task dev
```

Check the tool definitions:

```bash
cd examples/svelte
deno task check:tools
```

The example manually composes:

```text
menu.create
↓
menu.item.create × 3 in parallel
```

Later, this same tool contract will feed the manifest/workflow side of the SDK.
