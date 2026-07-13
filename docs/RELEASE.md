# Release guide

This project publishes the `gruntend-sdk` package to npm with Changesets and GitHub Actions.

## One-time setup

1. Confirm the package name is available:

   ```bash
   npm view gruntend-sdk name version --json
   ```

   A `404 Not Found` response means the name is still available.

2. Create an npm automation token with publish access.

3. Add the token to the GitHub repository as:

   ```text
   NPM_TOKEN
   ```

4. Keep GitHub Actions enabled for `.github/workflows/ci.yml` and `.github/workflows/release.yml`.

   The release job only runs on `refs/heads/main`, including manual `workflow_dispatch` runs.
   The publish step has `id-token: write`, `publishConfig.provenance: true`, and `NPM_CONFIG_PROVENANCE=true` so npm can attach provenance from the GitHub-hosted runner.

## Validate a release locally

Run these before merging a release PR or publishing manually:

```bash
pnpm install --frozen-lockfile
pnpm fmt:check
pnpm check
pnpm test
pnpm build
npm pack --dry-run --json
pnpm --filter gruntend-sveltekit-example build
pnpm --filter gruntend-website build
```

Optional package smoke test:

```bash
tmp_dir=$(mktemp -d)
npm pack --pack-destination "$tmp_dir" --json
cd "$tmp_dir"
npm init -y
npm install ./gruntend-sdk-0.1.0.tgz
node --input-type=module -e 'import { createGruntendClient } from "gruntend-sdk/client"; import { defineTools } from "gruntend-sdk/tool"; console.log(Boolean(createGruntendClient({ tools: defineTools({}) }).registry));'
node --input-type=module -e 'await Promise.all(["gruntend-sdk/client","gruntend-sdk/code-plan","gruntend-sdk/generate","gruntend-sdk/registry","gruntend-sdk/runtime","gruntend-sdk/tool","gruntend-sdk/ui","gruntend-sdk/ui/dom","gruntend-sdk/ui-runtime"].map((id) => import(id))); console.log("core subpath imports ok");'
```

Framework adapter exports (`gruntend-sdk/ui/react`, `gruntend-sdk/ui/solid`, `gruntend-sdk/ui/svelte`, and `gruntend-sdk/ui/vue`) are source-backed and should be verified by the consuming framework build.

## Initial `0.1.0` release

`gruntend-sdk@0.1.0` was published manually to npm. The release branch does not need a changeset because no new package version should be created when it merges.

After the release branch lands on `main`, create the initial GitHub release from the merge commit:

```text
Tag: gruntend-sdk@0.1.0
Title: gruntend-sdk v0.1.0 — Initial beta
Target: main
```

Mark the GitHub release as a pre-release while the SDK remains beta. Link to the published package in the release notes:

```text
https://www.npmjs.com/package/gruntend-sdk
```

The release workflow will detect that `0.1.0` already exists on npm and skip publishing it again.

## Future releases

The next patch release after `0.1.0` is `0.1.1`. For every user-facing package change, add a changeset:

```bash
pnpm changeset
```

Choose the bump type:

- `patch` for bug fixes and documentation-only package-facing corrections.
- `minor` for new backwards-compatible APIs.
- `major` for breaking API or behavior changes.

When changesets land on `main`, the release workflow opens a version PR that updates `package.json`, `pnpm-lock.yaml`, and `CHANGELOG.md`.

Merge the version PR to publish the new npm version.

Use `npm pack --dry-run --json` to inspect package contents without publishing. Do not run `pnpm release` or `changeset publish` as a dry run.

## Manual fallback

Only use this if GitHub Actions is unavailable:

```bash
pnpm install --frozen-lockfile
pnpm fmt:check
pnpm check
pnpm test
pnpm build
npm pack --dry-run --json
pnpm release
```

Do not run `pnpm release` until you intentionally want to publish to npm.
