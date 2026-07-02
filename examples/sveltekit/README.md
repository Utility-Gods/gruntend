# Gruntend SvelteKit Example

A real-ish SvelteKit app for Gruntend agents.

This example has:

- seeded in-memory restaurant data
- API routes for menus, nested menu items, and users
- normal app routes for browsing that data
- a Gruntend tool namespace over the app API
- an agent route with a mock LLM planner that returns code plans

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

The mock planner returns code. Gruntend executes that code against registered tools, and the handlers call this app's API routes.

## Validate

```bash
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```
