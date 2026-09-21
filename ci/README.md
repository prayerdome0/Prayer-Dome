# Continuous integration

GitHub Actions runs the same checks a release runs: production lint, the
managed-SEO check, the full test suite, Cloud Functions verification and the
Android build.

## Workflows in this folder

`verify.yml` runs on every push and pull request:

- `npm run lint` — production validation + managed SEO
- `npm test` — the full test suite
- `npm run functions:verify` — Cloud Functions install/verify
- `npm run build:vercel` — builds the production bundle

## Installing it

The workflow files are kept here (and `mobile/android-build.yml`) rather than
in `.github/workflows/` because the GitHub App used to push this branch does
not hold the `workflows` permission and GitHub rejects such pushes outright.
A maintainer with normal repository access activates them with one command:

```bash
node scripts/install-workflows.mjs
git push
```

After that, every push to `main` verifies the project and the Android build
attaches installable APK/AAB artifacts to the workflow run.
