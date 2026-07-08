# Gruntend SvelteKit Example

A real-ish SvelteKit app for Gruntend agents.

This example has:

- seeded Bun SQLite restaurant data in `.gruntend/example.sqlite`
- API routes for menus, nested menu items, and users
- normal app routes for browsing that data
- a Gruntend tool namespace over the app API
- a chat-style agent route with a mocked code-plan generator
- hypermedia message islands hydrated through `gruntend/hypermedia`

## Run

```bash
pnpm --filter gruntend-sveltekit-example dev
```

This example intentionally runs the SvelteKit dev server under Bun because the server store uses built-in `bun:sqlite`.

Open:

- `/menus`
- `/menus/menu_1`
- `/users`
- `/agent`

## Agent prompts

Try:

```text
Copy "Dinner Menu" to "Lunch Menu" except burgers
Add vegetarian items to "Brunch Menu"
Create user "Sam Rivera" as manager
Summarize the restaurant data
```

The agent route is mocked on purpose: `/api/agent/plan` returns deterministic Gruntend code plans without requiring `OPENAI_API_KEY`. The browser still executes those plans through the real Gruntend runtime, registered app tools, and app-owned handlers.

The chat transcript can render HTML hypermedia surfaces. Those surfaces contain inert semantic controls such as `gr-href="/menus"` or `gr-href="/menus/menu_1/items/item_2/actions/duplicate"`; the Svelte `HtmlSurface` island hydrates them with `hydrateHtmlSurface()` and sends the semantic href back to the page. Item actions are compiled into Gruntend code plans and executed through app tools; they do not directly call backend functions from the click handler.

## Switching back to a real LLM later

The switch point is intentionally small: replace the mock implementation in:

```text
examples/sveltekit/src/routes/api/agent/plan/+server.ts
```

with `generateCodePlan()` from `gruntend/generate` and pass your model/options there. The rest of the page can keep consuming the same response shape:

```ts
{
  generator: "mock" | "pi-ai";
  model?: string;
  plan: { summary: string; input: Record<string, unknown>; code: string };
}
```

## Validate

```bash
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```
