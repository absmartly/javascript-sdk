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

`workflow_dispatch` is **always a dry run**. Its optional `use_npm_token` input
uses `secrets.NPM_TOKEN` as `NODE_AUTH_TOKEN` for a fallback authentication test
only. If opted in, the owner must supply that secret; it is not needed for OIDC.
A manual dry run does not prove npm will accept OIDC on a real tag: the owner must
retain the npm publisher configuration and approve any environment protections.

Prereleases (for example `1.15.0-beta.0`) publish under their prerelease id (`beta`), never `latest`. A stable version that is not newer than `npm latest` in the same major (for example a 1.13.x backport after 1.14.0) fails the check, so the owner chooses its tag. When this package's major is lower than `npm latest`, the workflow uses `v1-lts`
(or `v<major>-lts`), leaving latest alone. **Owner deviation to approve:** the
requested `--tag v1` is impossible: npm 11.6.2 rejects it with `Tag name must not
be a valid SemVer range: v1`. `v1-lts` passes the same dry run. For 1.14.0 today,
latest is 1.13.4, so the selected tag is `latest`.

The previous major receives bug fixes for 12 months after 2.0. All other breaking
API modernization starts from the already-preserved `next/major`; docs-site work
waits for all SDKs' next-major releases.
