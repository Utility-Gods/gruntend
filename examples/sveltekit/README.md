# Gruntend SvelteKit Example

A real-ish SvelteKit app for Gruntend agents.

This example has:

- seeded Bun SQLite restaurant data in `.gruntend/example.sqlite`
- SvelteKit remote functions for menus, nested menu items, users, and agent planning
- normal app routes for browsing that data
- a Gruntend tool namespace over app-owned remote handlers
- a chat-style agent route with a mocked code-plan generator
- tagged-template message islands rendered through `gruntend/ui` and `gruntend/ui/svelte`

## Run

```bash
pnpm build
pnpm --filter gruntend-sveltekit-example dev
```

This example intentionally runs the SvelteKit dev server under Bun because the server store uses built-in `bun:sqlite`.

## Publish under `/example`

Set the SvelteKit base path when building or running the public demo:

```bash
pnpm build
GRUNTEND_EXAMPLE_BASE_PATH=/example pnpm --filter gruntend-sveltekit-example build
```

Then route `https://gruntend.com/example` to this app through your host or reverse proxy. Keep the LLM key only on the server:

```env
GRUNTEND_AGENT_MODE=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

For a public demo, set an LLM provider spend cap and consider Cloudflare rate limiting or Turnstile before allowing planning requests.

Open:

- `/menus`
- `/menus/menu_1`
- `/users`
- `/agent`

## Agent prompts

Try:

```text
Show a selectable "Dinner Menu" page
Copy "Dinner Menu" to "Lunch Menu" except burgers
Add vegetarian items to "Brunch Menu"
Create user "Sam Rivera" as manager
Summarize the restaurant data
```

The agent route is mocked on purpose and returns deterministic Gruntend code plans without requiring `OPENAI_API_KEY`. The browser still executes those plans through the real Gruntend runtime, registered app tools, and app-owned handlers.

The chat transcript renders generated UI returned from code plans as native JavaScript plus the Gruntend `html` tagged template. Event handlers use function interpolation, for example `onclick=${handler}`. The UI compiler rewrites those handlers to inert delegated attributes such as `data-gr-click="h0"`, so the browser never receives real inline JavaScript. The selectable menu prompt demonstrates local generated component state plus app tool calls for duplicated items.

## Switching back to a real LLM later

The switch point is intentionally small: use `generateCodePlan()` from `gruntend/generate` inside `examples/sveltekit/src/lib/remote/agent.remote.ts` and pass your model/options there. The rest of the page can keep consuming the same response shape:

```ts
{
  generator: "mock" | "pi-ai";
  model?: string;
  plan: { summary: string; input: Record<string, unknown>; code: string };
}
```

## Validate

```bash
pnpm build
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```
