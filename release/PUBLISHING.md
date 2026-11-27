# Publishing 1.14.0 (owner action only)

This PR does not create tags or publish. Once reviewed/merged, the owner may create
`v1.14.0` at the chosen release commit. The tag must equal `v` plus `package.json`
version; package-lock and the generated SDK agent version must agree.

`publish.yml` uses GitHub's `npm` environment and OIDC Trusted Publishing. The npm
trusted publisher must match **absmartly/javascript-sdk**, **publish.yml**,
environment **npm** (already configured by the owner). No npm token is required
for the normal tag run. Environment protection may require owner approval.

The workflow installs Node 22 and npm 11.6.2, installs with scripts disabled, checks
the registry latest major and exact tag, runs the full build/tests, inspects the
package, and publishes with provenance/public access. npm rejects an already
published version; it is never overwritten. A failed latest lookup fails closed.
All publish jobs, including manual dry runs, share the fixed package-wide concurrency
group `npm-publish-absmartly-javascript-sdk`, with `cancel-in-progress: false`.
Registry/tag validation and publishing run inside that same locked job, so concurrent
release tags cannot both validate against a stale `latest` and then move it backwards.

If a tag run is cancelled or fails before the publish step, nothing reached npm:
re-run the failed job from the Actions page (same tag, same commit). If it failed
after npm accepted the version, do not re-tag; `npm view @absmartly/javascript-sdk@<version>`
confirms the upload, and `npm dist-tag add @absmartly/javascript-sdk@<version> <tag>`
fixes a missing or wrong distribution tag. Never delete and re-push a tag to retry: a
moved tag no longer matches the published provenance.

`workflow_dispatch` is **always a dry run** and is a package preflight only: it checks
the version, tag selection, build and package contents. npm's dry run skips the
authenticated publish request, so it does not prove OIDC (or any token) works; the
owner must keep the npm trusted-publisher configuration and approve any environment
protections. No `NPM_TOKEN` secret is used or needed.

Prereleases use a bounded set of distribution channels: `alpha`, `beta`, `rc`, and
`next`. The first prerelease identifier is matched case-insensitively and normalized
to lowercase (for example `1.15.0-BETA.0` uses `beta`). Every other identifier maps
to `next`, including `latest`, `LATEST`, `v1`, and numeric identifiers. A prerelease
never publishes to `latest` or an arbitrary npm tag.

A stable version that is not newer than `npm latest` in the same major (for example
a 1.13.x backport after 1.14.0) fails the check, so the owner chooses its tag. When
this package's major is lower than `npm latest`, the workflow uses `v1-lts`
(or `v<major>-lts`), leaving latest alone. **Owner deviation to approve:** the
requested `--tag v1` is impossible: npm 11.6.2 rejects it with `Tag name must not
be a valid SemVer range: v1`. `v1-lts` passes the same dry run. For 1.14.0 today,
latest is 1.13.4, so the selected tag is `latest`.

The previous major receives bug fixes for 12 months after 2.0. All other breaking
API modernization starts from the already-preserved `next/major`; docs-site work
waits for all SDKs' next-major releases.
