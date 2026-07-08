# Agent Instructions

- Prefer concise shell commands that the user can copy and run manually.
- Do not run tests, package-manager commands, npm scripts, or pnpm scripts yourself. If validation is needed, tell the user the exact command to run manually.
- This project targets Node/TypeScript with pnpm workspaces.
- Pin dependency versions exactly in `package.json` files; avoid `latest`, caret ranges, and broad ranges for supply-chain safety.
- After dependency changes, update `pnpm-lock.yaml` and run the affected checks:
  - `pnpm test`
  - `pnpm check`
  - `pnpm --filter gruntend-sveltekit-example build` when the example changes
- Keep the public SDK thin, object-based, and explicit.
- Do not add barrel files. Prefer explicit subpath imports such as `gruntend/tool`, `gruntend/client`, and local `../src/tool.ts` imports in tests.
- Keep `defineTools()` contract-only.
- Handlers are async runtime closures owned by the app.
- Expected failures use `err(...)`, not throwing. Throwing remains fallback for unexpected failures.
- Use a single `onEvent(event)` lifecycle stream.
