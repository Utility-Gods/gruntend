---
name: photoship-design-system
description: "Use when styling or restructuring the SvelteKit example UI. Follow the Photoship component-system approach: shared components, app chrome, compact surfaces, orange primary actions, neutral cards, badges, tabs, forms, and clear workflow/report layouts."
---

# Photoship Design System

Use this skill for UI/design work in `examples/sveltekit`.

The goal is to use the Photoship **color language and restraint**, not to copy Photoship's layout, logo treatment, typography, heavy chrome, pills, badges, or component shapes.

## Source of Truth

When changing UI, inspect Photoship component patterns first:

- `/home/d2du/code/ug/photoship-go/static/css/app.css`
- `/home/d2du/code/ug/photoship-go/internals/template/ui/button.go`
- `/home/d2du/code/ug/photoship-go/internals/template/ui/card.go`
- `/home/d2du/code/ug/photoship-go/internals/template/ui/form.go`
- `/home/d2du/code/ug/photoship-go/internals/template/ui/badge.go`
- `/home/d2du/code/ug/photoship-go/internals/template/ui/app_chrome.go`
- `/home/d2du/code/ug/photoship-go/internals/template/layout/sidebar.templ`
- `/home/d2du/code/ug/photoship-go/internals/template/pages/dashboard.templ`

## Local Component Layer

Put reusable Photoship-style Svelte components under:

```text
examples/sveltekit/src/lib/components/photoship/
```

Use explicit imports. Do **not** add barrel files.

Preferred components:

```text
AppShell.svelte
Button.svelte
Card.svelte
Badge.svelte
SurfaceHeader.svelte
CodeBlock.svelte
Tabs.svelte       # add when needed
Menu.svelte       # add when needed
EmptyState.svelte # add when needed
```

Pages should compose these components instead of defining one-off local button/card/badge styles.

## Design Rules

- Treat the UI as an app/dashboard, not a marketing landing page.
- Do **not** copy Photoship layout/chrome. For this example prefer a simple top nav and quiet content area.
- Use a light, smooth system font stack. Do **not** use Montserrat-heavy oversized headings.
- Prefer Tailwind utilities in pages for one-off layout; only use shared components when they reduce complexity.
- Use Photoship colors only as theme inspiration:
  - orange primary actions
  - neutral backgrounds
  - dark text
  - subtle gray dividers
- Use Photoship tokens:
  - primary orange: `#f54a00`
  - primary hover: `#c2410c`
  - dark navy: `#0f172a`
  - neutral OKLCH grays
- Prefer compact, structured surfaces:
  - card header
  - card body
  - optional footer/actions
- Buttons should follow the Photoship variants:
  - default
  - primary
  - secondary
  - ghost
  - primary-outline
  - danger
- Forms should use shared input/textarea styles with orange focus rings.
- Avoid badges unless they communicate real state. Do not decorate the UI with badges.
- Avoid pill buttons and excessive rounded corners. Use mostly square or lightly rounded controls.
- Avoid nested bordered boxes. A card should not contain another bordered card unless absolutely necessary.
- Use dividers, whitespace, and type scale instead of stacking borders.
- Use icons/marks sparingly. Do not mimic the Photoship logo.
- Use shadows rarely. Do not create giant floating marketing cards.
- Keep headings modest: no huge hero typography for normal app screens.
- Avoid decorative gradients.

## Agent Page UX

For `/agent`, make the user understand what happened:

```text
Task input
↓
LLM generated a plan
↓
Gruntend validated tool calls
↓
App handlers changed/read data
↓
Result + next actions
```

Show:

- summary
- model
- stop reason
- usage/cost when available
- response id
- plan input
- generated code
- tool calls/events
- final result

Do not dump full raw model messages, thinking, or encrypted payloads.

## Workflow

1. Use Photoship colors/tokens as reference only.
2. Prefer simple Tailwind layout in the page.
3. Remove unnecessary nested borders, badges, pills, heavy font weights, and oversized headings.
4. Run:

```bash
pnpm --filter gruntend-sveltekit-example check
pnpm --filter gruntend-sveltekit-example build
```

If package/dependency changes are made, also run root checks from `AGENTS.md`.
