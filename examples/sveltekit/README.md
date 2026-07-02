# Gruntend SvelteKit Example

A real-ish SvelteKit app for Gruntend agents.

This example has:

- seeded in-memory restaurant data
- API routes for menus, nested menu items, and users
- normal app routes for browsing that data
- a Gruntend tool namespace over the app API
- an agent route with a real pi-ai/OpenAI generator powered by `gruntend/generate`

## Run

```bash
pnpm --filter gruntend-sveltekit-example dev
```

Open:

- `/menus`
- `/menus/menu_1`
- `/users`
- `/agent`

## Agent prompts

Try:

```text
Copy "Dinner Menu" to "Lunch Menu"
Add vegetarian items to "Brunch Menu"
Create user "Sam Rivera" as manager
Summarize the restaurant data
```

The agent route calls the SDK boundary on the SvelteKit server: Gruntend builds the prompt, calls pi-ai/OpenAI, parses the response, and returns a code plan. Gruntend then executes that code against registered tools, and the handlers call this app's API routes.

## Real LLM mode

Copy `.env.example` to `.env` inside `examples/sveltekit`:

```bash
cp examples/sveltekit/.env.example examples/sveltekit/.env
```

Set:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.1
```

Then open `/agent` and submit a task.

## Validate

```bash
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```
