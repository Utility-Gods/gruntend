# Changesets

Create a changeset for every user-facing package change:

```bash
pnpm changeset
```

The release workflow opens a version PR when changesets exist on `main`. Merging that PR publishes the package to npm with provenance when `NPM_TOKEN` is configured.
