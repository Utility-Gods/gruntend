---
name: test-driven-development
description: Project TDD workflow for GenOpen SDK development. Use before implementing any SDK feature: define the smallest contract, write failing tests first, implement the minimum, then refactor.
---

# Test Driven Development

Use this workflow for every SDK feature.

## Cycle

1. **RED** — define the smallest public contract and write a focused failing test.
2. Run the relevant Deno test and confirm it fails for the expected reason.
3. **GREEN** — implement the smallest code that satisfies the test.
4. Rerun the relevant test until it passes.
5. **REFACTOR** — clean up only after tests pass.

## Rules

- Never write implementation before the test for a new behavior.
- Do not add placeholder/sample tests unrelated to GenOpen.
- Do not test random functions such as `add()`.
- Tests live in `tests/`, not the repository root.
- Source lives in `src/`; `mod.ts` only exports the public API.
- Test public contracts and behavior, not private implementation details.
- Keep tests small and named after the behavior being specified.
- Prefer thin object-based APIs over fluent builders or class-heavy abstractions.

## Deno Commands

```bash
deno test tests/<file>.test.ts
deno test
```
