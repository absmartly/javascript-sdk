# Changelog

## 1.14.0

### Added

- `ABsmartly` alias for `SDK`, `readyError()`, `getSDK()`, `getOptions()`, and client
  application/environment/agent getters; existing names remain supported.
- Optional `assignmentRules`, holdout models and variant names in context data.
- Semantic-version expression operators (`semver_eq/gt/gte/lt/lte`) and
  `Evaluator.versionCompare`; old expression operators keep their conversion rules.
- Optional `includeSystemAttributes` publishes `sdk_name` and `sdk_version` only.
- The `SDK` and `Client` constructors also accept a string application version
  (`application: { name, version: "1.2.3" }`) through the new `ClientInputOptions`
  overload. `ClientOptions` and the constructors' released signatures are unchanged.
- Tag-driven npm Trusted Publishing and a manual publish dry run, plus a
  `repository` field in `package.json`, which npm provenance requires.

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
  query parameters, like PUT. The low-level `request()`, `post()`, `put()` and
  `getUnauthed()` keep their 1.13.4 header rules.
  `X-Application-Version` sends only 1–18 ASCII digits (trimmed), or `0` otherwise.
  Affected: proxies inspecting GET headers and apps configuring invalid version
  headers that previously caused collector HTTP 400 errors.
- Shared variable keys retain experiment-id priority and fall through unassigned
  experiments or variants missing the key; peek queues no exposures. The existing
  `variableKeys()` map-of-lists return shape is unchanged.
- A per-request `timeout` now also bounds the retry budget; 1.13.4 always used the
  client timeout for it. Affected: callers passing a per-request `timeout` that
  differs from the client one, who now get more (or fewer) retries to match it.
  `timeout: 0` keeps its 1.13.4 meaning: a request value of 0 falls back to the
  client timeout, and a client timeout of 0 means no retries.
- An audience whose evaluation throws now counts as a mismatch (fail closed) and
  emits one logger `error` event; in 1.13.4 it was ignored, so strict audiences
  could let users through. Affected: strict audiences with, for example, a throwing
  attribute getter now serve control. Only a path through a `null` attribute is
  still logged to the console and the audience ignored, as in 1.13.4.
- New runtime dependency `@babel/runtime` (shared Babel helpers, which shrink the
  browser bundle). It declares Node `>=6.9.0`; the package still declares `>=6`, so
  Node 6.0–6.8 installs may warn. No helper types are exposed in the public API.
- Re-evaluating an audience after `setAttribute` now also checks the assignment-rule
  and holdout state. Measured on Node 22 (synthetic, one audience experiment): about
  4% faster than 1.13.4 with 300 attributes, about 6% slower with 1,000 and about
  16% slower with 3,000. Ordinary cached reads, `getAttributes()` and publishing are
  at or below 1.13.4 cost.

### Fixed

- Failed publishes retain queued events in order; failed finalize stays open and
  can be retried. Concurrent flush/finalize waits for in-flight delivery.
- Custom publisher failures and throwing event loggers no longer strand lifecycle
  promises or lose/duplicate successfully delivered events.
- Malformed variant configs are isolated rather than failing the entire context.
- The browser bundle is ES5 again (IE 10): `rfdc` >= 1.4 ships ES2015 syntax, so
  it is now transpiled, and the build fails if `dist/` is not ES5.
- Query keys are encoded and unmatched query surrogates no longer throw URIError.
- The bundled `AbortController` shim matches the native one: a second `abort()` is
  a no-op (listeners fire once) and `signal.reason` is set.
- `fetch` is detected through `globalThis` as well as `window`/`self`/`global`, and
  a missing implementation now throws "No fetch implementation found" instead of an
  undefined-call TypeError.
