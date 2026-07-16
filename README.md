# application-tracker

Same architecture as finance-tracker: app code public (required for GitHub
Pages on the Free plan), data in a separate private repo, read and written
through the GitHub Contents API. Deploy is now handled entirely by GitHub
Actions, not local git commands, so none of the Windows-specific issues
from earlier (ENAMETOOLONG, embedded repos, branch mismatches) apply here.

## Two repos

1. **application-tracker** (this one, public): the code, deployed via
   GitHub Pages.
2. **application-tracker-data** (private, create separately, empty is
   fine): holds `data/log.json` and `data/summary.json`. Created
   automatically on first write, you don't need to seed anything.

## From-scratch setup

### 1. Create both repos on GitHub

- `application-tracker`, public, empty (no README/gitignore auto-added)
- `application-tracker-data`, private, empty

### 2. Push this code

```
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<OWNER>/application-tracker.git
git push -u origin main
```

### 3. Enable Pages via Actions

Repo Settings, Pages, under "Build and deployment", set Source to
**GitHub Actions** (not "Deploy from a branch"). The workflow in
`.github/workflows/deploy.yml` runs automatically on this push and every
push after, builds the app, and publishes it. Check the Actions tab to
watch it run.

### 4. Local dev (optional, only if you want to test before pushing)

```
npm install
npm run dev
```

You never need to run `npm run build` or touch `dist/` yourself, Actions
does that on every push to `main`.

## Using the app

Open `https://<owner>.github.io/application-tracker/` once the Actions run
finishes (check the Actions tab for the green check). Settings panel is
open by default until you add a token. Paste a GitHub personal access
token, fine-grained, Contents read/write scoped to
**application-tracker-data only**. Token lives in `localStorage`, never
committed. Log your daily count, it writes:

- `data/log.json`, full daily history (date to {count, mlInfra, note})
- `data/summary.json`, precomputed rollup (streak, today, week)

## What changed from the manual approach

No more `npm run deploy`, no more `cd dist && git init`, no more picking
between `master`/`main` locally for a throwaway build folder. Push to
`main`, Actions builds and publishes. If a deploy fails, the Actions tab
shows exactly why, no more guessing from a Windows spawn error.
