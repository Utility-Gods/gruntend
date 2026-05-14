# Agent Instructions

- Prefer concise shell commands that the user can copy and run manually.
- For Deno dependencies, prefer JSR packages over npm packages when an equivalent exists.
- Pin Deno dependency versions exactly in `deno.json` / example `deno.json` files; avoid `@latest` and broad ranges for supply-chain safety.
- Use npm specifiers only when there is no suitable JSR package, and keep those versions exact too.
- After dependency changes, update the relevant `deno.lock` and run the affected `deno test` / `deno check` commands.
- Avoid broad `deno run -A` permissions unless the tool genuinely needs them; prefer least-permission flags where practical.
