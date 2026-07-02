# Gruntend Svelte Example

Reference frontend app that imports Gruntend, defines a small tool namespace, asks a mock LLM for a code plan, and executes that plan through app-owned handlers.

Run from the repository root:

```bash
pnpm --filter gruntend-svelte-example dev
```

Build:

```bash
pnpm --filter gruntend-svelte-example build
```

The example composes tools in generated code:

```ts
const menu = await tools.menu.create({ name: "Dinner Menu" });

const createdItems = await parallel(
  items.map((item) =>
    tools.menu.item.create({
      menuId: menu.menuId,
      name: item.name,
      price: item.price,
    })
  )
);
```

The generated code can branch, loop, and fan out dynamically, but it can only call registered tools.
