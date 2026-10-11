# Auto-publish Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that auto-publishes `@absmartly/javascript-sdk` to npm whenever a merge to `main` introduces a new `version` in `package.json`.

**Architecture:** A single new workflow file `.github/workflows/publish.yml` triggered on push to `main`. Reads `version` from `package.json`, queries npm to see if it's already published, derives the dist-tag from the version string (`alpha` / `beta` / `latest`), and publishes with provenance via OIDC trusted publishing. No token secret in the repo.

**Tech Stack:** GitHub Actions, Node.js 24 (from `.nvmrc`), npm (OIDC trusted publishing + provenance).

**Reference spec:** `docs/superpowers/specs/2026-04-24-auto-publish-design.md`

---

## Testing philosophy

GitHub Actions workflows can't be unit-tested in the TDD sense — there's no local harness that exercises OIDC, merge events, and the npm registry end-to-end. Verification is therefore:

1. **Static:** YAML parses and passes actionlint.
2. **Dry-run on main:** first merge lands a commit where the version is already published → workflow runs, version-check step exits green without publishing.
3. **Wet-run on main:** follow-up PR bumps version → workflow publishes; confirm via `npm view`.

Each task below is explicit about which level of verification applies.

---

## Prerequisite (manual, human-only)

One-time setup on npmjs.com. The workflow will fail at the publish step until this is done.

- [ ] **P1:** Visit <https://www.npmjs.com/package/@absmartly/javascript-sdk/access>
- [ ] **P2:** Settings → Trusted Publishing → GitHub Actions. Add a new trusted publisher with:
  - **Organization or user:** `absmartly`
  - **Repository:** `javascript-sdk`
  - **Workflow filename:** `publish.yml`
  - **Environment name:** (leave empty)
- [ ] **P3:** Save.

---

## Task 1: Create working branch

**Files:** none (git branch operation)

- [ ] **Step 1.1: Confirm clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` (or only untracked files unrelated to this task — flag any surprise changes before continuing).

- [ ] **Step 1.2: Create branch**

Run:
```bash
git checkout -b ci/auto-publish
```

---

## Task 2: Write the publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 2.1: Create the workflow file**

Write `.github/workflows/publish.yml` with exactly this content:

```yaml
name: Publish

on:
  push:
    branches:
      - main

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: ".nvmrc"
          registry-url: "https://registry.npmjs.org"
          cache: "npm"

      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Read version from package.json
        id: version
        run: echo "version=$(node -p "require('./package.json').version")" >> "$GITHUB_OUTPUT"

      - name: Check if version is already on npm
        id: check
        shell: bash
        run: |
          set -euo pipefail
          V="${{ steps.version.outputs.version }}"
          PUBLISHED=$(npm view "@absmartly/javascript-sdk@${V}" version)
          if [ -z "$PUBLISHED" ]; then
            echo "Version ${V} is not on npm — will publish."
            echo "should_publish=true" >> "$GITHUB_OUTPUT"
          else
            echo "Version ${V} already published — skipping."
            echo "should_publish=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Derive npm dist-tag
        if: steps.check.outputs.should_publish == 'true'
        id: tag
        shell: bash
        run: |
          V="${{ steps.version.outputs.version }}"
          case "$V" in
            *-alpha*) TAG=alpha ;;
            *-beta*)  TAG=beta ;;
            *)        TAG=latest ;;
          esac
          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"

      - name: Publish to npm
        if: steps.check.outputs.should_publish == 'true'
        run: npm publish --provenance --tag "${{ steps.tag.outputs.tag }}"
```

Notes on the content (do not add as comments in the YAML — they're for the implementer):
- `registry-url` on `setup-node` is required for `npm publish` to authenticate via OIDC.
- `npm ci --ignore-scripts` matches the pattern in `build.yml`.
- No `--access public` needed; `publishConfig.access: public` is already in `package.json`.
- Running `npm publish` triggers `prepack`, which runs the full `npm run build` (format/lint/compile/test/build-*). That's intentional — tests gate the publish.
- `set -euo pipefail` makes the version-check step fail on any unexpected `npm view` error (matches spec's third case).

- [ ] **Step 2.2: Verify YAML parses**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish.yml'))" && echo OK
```
Expected: `OK`.

- [ ] **Step 2.3: Lint with actionlint (if available)**

Run:
```bash
command -v actionlint >/dev/null && actionlint .github/workflows/publish.yml || echo "actionlint not installed — skipping (will be caught on push)"
```
Expected: either no output (lint clean) or the "skipping" message.

Do not install actionlint just for this check — GitHub will surface any real syntax errors when the workflow lands on `main`.

---

## Task 3: Commit and push

**Files:** none (git only)

- [ ] **Step 3.1: Stage and commit**

Run:
```bash
git add .github/workflows/publish.yml
git commit -m "ci: auto-publish to npm on merge to main

Adds .github/workflows/publish.yml. Fires on push to main, skips
silently if the package.json version is already on npm, otherwise
derives the dist-tag from the version string (alpha/beta/latest)
and publishes with provenance via OIDC trusted publishing. Requires
a one-time Trusted Publisher configuration on npmjs.com for this
package (see docs/superpowers/specs/2026-04-24-auto-publish-design.md)."
```

- [ ] **Step 3.2: Push**

Run:
```bash
git push -u origin ci/auto-publish
```

---

## Task 4: Open PR

**Files:** none

- [ ] **Step 4.1: Open PR**

Run:
```bash
gh pr create --title "ci: auto-publish to npm on merge to main" --body "$(cat <<'EOF'
## Summary
- Adds \`.github/workflows/publish.yml\` — publishes to npm on push to main when \`package.json\` version changes.
- OIDC trusted publishing (no \`NPM_TOKEN\` secret needed); provenance attestations enabled.
- Tag derived from version: \`-alpha\` → \`alpha\`, \`-beta\` → \`beta\`, else \`latest\`.
- Design: \`docs/superpowers/specs/2026-04-24-auto-publish-design.md\`.

## Prerequisite
Complete the Trusted Publisher setup on https://www.npmjs.com/package/@absmartly/javascript-sdk/access **before merging**. Until it's done, the publish step of this workflow will fail.

## Test plan
- [ ] YAML parses and actionlint passes (local).
- [ ] After merge, first workflow run on main (where \`package.json\` version is already on npm) exits green without publishing.
- [ ] Open a follow-up PR bumping version to \`1.14.0-beta.2\`; after merge, workflow publishes and \`npm view @absmartly/javascript-sdk dist-tags\` shows \`beta: 1.14.0-beta.2\` with a provenance badge on npmjs.com.
EOF
)"
```

- [ ] **Step 4.2: Confirm required checks pass on the PR**

Watch the PR's Actions runs. `build.yml` should run (format + build + test). The new `publish.yml` only runs on push to `main`, so it will not run on the PR itself.

---

## Task 5: Post-merge — dry-run verification

**When to do this:** after the PR from Task 4 is merged, but before any version bump.

- [ ] **Step 5.1: Open the Actions tab**

Navigate to the repo's Actions tab on GitHub. Find the `Publish` workflow run triggered by the merge commit.

- [ ] **Step 5.2: Confirm expected behavior**

Expected:
- Overall status: **success** (green).
- `Read version from package.json` → outputs the current `package.json` version (e.g. `1.14.0-beta.1`).
- `Check if version is already on npm` → prints `Version … already published — skipping.` and sets `should_publish=false`.
- `Derive npm dist-tag` and `Publish to npm` steps show as **skipped**.
- Nothing publishes. `npm view @absmartly/javascript-sdk dist-tags` output is unchanged from before.

If the run fails: do NOT bump the version until you've fixed the workflow. Most likely failure modes and fixes:
- **`npm view` step fails non-zero:** transient registry flake, re-run the job. If repeatable, check the package name spelling.
- **Publish step fails with auth error on the dry-run:** shouldn't be reached (it's `if: should_publish == 'true'`), but if it does, the version-check logic has a bug — revisit the `[ -z "$PUBLISHED" ]` branch.

---

## Task 6: Post-merge — live publish verification

**When to do this:** after Task 5 shows a clean dry-run.

- [ ] **Step 6.1: Bump version in a small PR**

Run:
```bash
git checkout main && git pull --ff-only
git checkout -b chore/bump-to-beta-2
node -e "const p=require('./package.json'); p.version='1.14.0-beta.2'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n');"
git add package.json
git commit -m "chore: bump version to 1.14.0-beta.2"
git push -u origin chore/bump-to-beta-2
gh pr create --title "chore: bump version to 1.14.0-beta.2" --body "Verifies the new auto-publish workflow."
```

- [ ] **Step 6.2: Merge the PR**

Via `gh pr merge <number> --squash` or the GitHub UI, whichever matches the repo's convention.

- [ ] **Step 6.3: Watch the Publish workflow run**

Expected on the merge commit:
- `Check if version is already on npm` → prints `Version 1.14.0-beta.2 is not on npm — will publish.`
- `Derive npm dist-tag` → outputs `tag=beta`.
- `Publish to npm` runs `npm publish --provenance --tag beta` and succeeds.

- [ ] **Step 6.4: Confirm on the registry**

Run:
```bash
npm view @absmartly/javascript-sdk dist-tags
```
Expected: `beta: '1.14.0-beta.2'`.

Then open <https://www.npmjs.com/package/@absmartly/javascript-sdk/v/1.14.0-beta.2> in a browser. Confirm the "Provenance" badge is visible on the version page.

---

## Self-review

- **Spec coverage:** Every section in `docs/superpowers/specs/2026-04-24-auto-publish-design.md` is realised by Tasks 2 (workflow shape, version check, tag routing, OIDC auth), 5 (dry-run idempotence), and 6 (live publish + provenance). The manual npmjs.com setup is captured in the Prerequisite block.
- **Placeholder scan:** no TBDs, TODOs, or "add appropriate X". Every code step has the actual code.
- **Type / name consistency:** step output names (`version`, `should_publish`, `tag`) are used consistently across steps of Task 2.
- **Non-goals respected:** plan does not generate a changelog, create a GitHub Release, or automate version bumps.
