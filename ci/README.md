# Continuous integration

`verify.yml` is the GitHub Actions workflow for this repository. It runs the
same checks a release runs — `npm run lint`, `npm test`, `npm run
functions:verify` and `npm run build:vercel` — on every push and pull request.

## Installing it

The workflow is kept here rather than in `.github/workflows/` because the
GitHub App used to push this branch does not hold the `workflows` permission
and the push is rejected outright. Enabling it is a one-time, one-command step
for a maintainer with normal repository access:

```bash
mkdir -p .github/workflows
git mv ci/verify.yml .github/workflows/verify.yml
git commit -m "Enable the Verify workflow"
git push
```

Nothing else needs to change — the workflow is complete and ready to run.
