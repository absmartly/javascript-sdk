# Changelog

## 1.14.0

### Added

- `ABsmartly` alias for `SDK`, `readyError()`, `getSDK()`, `getOptions()`, and client
  application/environment/agent getters; existing names remain supported.
- Optional `assignmentRules`, holdout models and variant names in context data.
- Semantic-version expression operators (`semver_eq/gt/gte/lt/lte`) and
  `Evaluator.versionCompare`; old expression operators keep their conversion rules.
- Optional `includeSystemAttributes` publishes `sdk_name` and `sdk_version` only.
- Tag-driven npm Trusted Publishing and a manual publish dry run.

### Changed

- Assignment rules take precedence over traffic, audience, custom assignment and
  holdout suppression (explicit overrides still win). A rule win publishes
  `ruleOverride: true`; every other exposure publishes `ruleOverride: false`.
  Affected: experiments configured with rules, and custom publishers/event loggers
  or wire consumers comparing complete exposure shapes. The type field is optional
  so existing customer-authored `Exposure` literals still compile.
- Audiences and rule conditions always see configured non-empty `application` and
  `environment`; explicit user attributes win. Rule environment scope uses the
  configured environment. No synthetic `app_version` is injected or published;
  explicitly set values remain valid and published. Affected: running experiments
  with system-name conditions, including strict/full-on audiences previously forced
  to control. This is the agreed cross-SDK contract, not an opt-in.
- Holdout-covered experiments suppress ordinary experiment exposure when held out;
  holdout exposures are deduplicated, and suppressed variable reads use control.
  Affected: applications whose context payload links experiments to holdouts.
- The default SDK `X-Agent` is `absmartly-javascript-sdk/1.14.0` instead of
  `absmartly-javascript-sdk`. Affected: export/dashboard filters matching the old
  agent exactly. Explicit customer agent strings are preserved.
- `GET /context` sends SDK authentication/metadata headers as well as the existing
  query parameters, like PUT. Explicit `getUnauthed()` retains its old behaviour.
  `X-Application-Version` sends only 1–18 ASCII digits (trimmed), or `0` otherwise.
  Affected: proxies inspecting GET headers and apps configuring invalid version
  headers that previously caused collector HTTP 400 errors.
- Shared variable keys retain experiment-id priority and fall through unassigned
  experiments or variants missing the key; peek queues no exposures. The existing
  `variableKeys()` map-of-lists return shape is unchanged.

### Fixed

- Failed publishes retain queued events in order; failed finalize stays open and
  can be retried. Concurrent flush/finalize waits for in-flight delivery.
- Custom publisher failures and throwing event loggers no longer strand lifecycle
  promises or lose/duplicate successfully delivered events.
- Malformed variant configs are isolated rather than failing the entire context;
  audience evaluation exceptions fail strict audiences closed.
- Per-request timeouts now govern the retry budget consistently; zero explicitly
  disables the deadline. Affected: callers overriding timeouts or using zero, whose
  configured limit was previously ignored by part of the retry path.
- Query keys are encoded and unmatched query surrogates no longer throw URIError.
- Preserve published 1.13.4 error strings, custom-field console diagnostics,
  live `getUnits()` return, legacy unit hashing, old TypeScript parser support,
  and existing model literals rather than shipping main-era compatibility breaks.
