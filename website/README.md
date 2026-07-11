# Gruntend website

The public documentation site uses Astro Starlight.

## Content structure

- `src/content/docs/` — public documentation
- `guides/` — outcome-oriented integration guides
- `reference/` — lower-level toolkit primitives
- `code-plan-format.mdx` — the decided plan format and its rationale

## Local development

From the repository root, after installing workspace dependencies:

```bash
pnpm --filter gruntend-website dev
```

Build the static site with:

```bash
pnpm --filter gruntend-website build
```
