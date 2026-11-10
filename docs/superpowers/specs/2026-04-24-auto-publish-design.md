# Auto-publish to npm on merge to main

## Summary

A new GitHub Actions workflow publishes `@absmartly/javascript-sdk` to npm automatically whenever a PR merged to `main` changes the `version` in `package.json`. Authentication uses npm's OIDC trusted publishing, so no long-lived token secret lives in the repo. Published tarballs carry provenance attestations.

## Motivation

Today, publishing is manual: bump the version in a PR, merge, then run `npm publish` locally, which requires an npm login with 2FA. This is error-prone (forgetting to publish, publishing from a dirty working tree, hitting EOTP in the middle of a release) and couples release to one person's machine. Automating it keeps the "bump version in a PR" habit the team already uses, and removes the manual step after merge.

## Goals

- Publish automatically when a merge to `main` introduces a new version.
- Route prerelease versions to the correct npm dist-tag (`alpha`, `beta`, or `latest`).
- No npm credentials stored as repo secrets; use OIDC trusted publishing.
- Attach npm provenance to published tarballs.
- Idempotent: re-running on a commit whose version is already published is a silent no-op.

## Non-goals

- No changelog generation.
- No GitHub Release creation.
- No automated version bumping. Humans still bump `version` in PRs.
- No `rc` prerelease tag handling. Add later if the project starts using it.
- No GitHub environment / manual approval gate.

## Trigger

`push` to `main`. PRs are already validated by `build.yml` before merge; this workflow fires on the merge commit.

## Version check

Before building, the workflow reads `version` from `package.json` and queries `npm view @absmartly/javascript-sdk versions --json` to get the list of all published versions of the package. It then checks for the local version in that list:

- Local version is in the list → version already published → skip publish, exit green.
- Local version is not in the list → publish.
- `npm view` exits non-zero (network error, package missing, etc.) → fail the workflow. Humans investigate rather than the workflow guessing.

Querying the `versions` array (which is always populated when the package exists) avoids the trap that `npm view <pkg>@<missing-version>` exits non-zero on npm 11+, which would otherwise make any new version look like a real error to `set -euo pipefail`.

This makes the workflow safe to re-run and safe to leave in place for commits that don't bump the version.

## Tag routing

Derived from the version string:

| Version pattern | npm dist-tag |
| --- | --- |
| `*-alpha*` (e.g. `1.14.0-alpha.2`) | `alpha` |
| `*-beta*` (e.g. `1.14.0-beta.1`) | `beta` |
| anything else (e.g. `1.14.0`) | `latest` |

Implemented as a `case` statement on the version string. Not semver-aware — just substring matching, which is sufficient for the project's current conventions.

## Auth

OIDC trusted publishing. The workflow job requests an OIDC token from GitHub (`id-token: write` permission), which npm exchanges for a short-lived publish credential. This also enables provenance (`npm publish --provenance`) — published tarballs get a signed attestation tying them to this repo, commit SHA, and workflow run, visible on npmjs.com.

### One-time manual setup on npmjs.com

Before merging this workflow, configure the package as a trusted publisher:

1. Go to <https://www.npmjs.com/package/@absmartly/javascript-sdk/access>
2. Settings → Trusted Publishing → GitHub Actions
3. Fill in:
   - **Organization or user:** `absmartly`
   - **Repository:** `javascript-sdk`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** (leave empty)
4. Save.

If step 1–4 are skipped, the first workflow run will fail at `npm publish` with an auth error; the package state on npm is unchanged.

## Build

Publishing runs `npm publish`, which invokes the `prepack` script (`npm run build`) — the full existing build chain (`format:check`, `lint`, `compile`, `test`, `build-es`, `build-cjs`, `build-browser`). This duplicates work `build.yml` already did on the same commit, but the duplication is cheap, keeps the workflow self-contained, and guarantees tests pass before publishing.

## Workflow outline

File: `.github/workflows/publish.yml`

Shape (not a final draft — the implementation plan will produce the concrete YAML):

- `on: push: branches: [main]`
- One job, `publish`, running on `ubuntu-latest`
- `permissions: contents: read, id-token: write`
- Steps:
  1. `actions/checkout@v6`
  2. `actions/setup-node@v6` with `node-version-file: .nvmrc`, `registry-url: https://registry.npmjs.org`, `cache: npm`
  3. `npm ci --ignore-scripts`
  4. Read version from `package.json`; check `npm view` for that version; set an output like `should_publish`
  5. If `should_publish`: derive dist-tag via `case` on version; run `npm publish --provenance --tag <derived>`

`publishConfig.access: public` is already in `package.json`, so no `--access public` flag is needed.

## Failure modes and recovery

- **Build/test fails in `prepack`** — workflow fails; nothing published; maintainers fix and re-merge (which is itself a new commit to `main`, retriggering the workflow). Since the version on `main` has not changed, re-runs on the same commit after an infra hiccup are idempotent.
- **OIDC exchange fails** (trusted publisher misconfigured) — workflow fails at publish step; package unchanged.
- **Version already published** — handled by the version-check step; workflow exits green without calling `npm publish`.
- **Race with a manual publish from a developer's laptop** — whichever publishes first wins; the other fails with "version already exists" (or, for the workflow, silently skips if the version check runs after the manual publish). Low risk now that auto-publish exists.

## Testing

The workflow itself can only be tested on `main`. Validate by:

1. Merge this workflow (initial commit does not bump version → workflow runs, version check skips publish, job green).
2. Open a follow-up PR bumping to `1.14.0-beta.2`; merge; confirm workflow publishes and `npm view @absmartly/javascript-sdk dist-tags` shows `beta: 1.14.0-beta.2`.
3. Check the published version's provenance on npmjs.com.

## Open questions

None.
