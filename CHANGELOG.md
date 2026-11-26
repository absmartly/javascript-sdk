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
- Tag-driven npm Trusted Publishing, a manual dry-run package preflight (it does
  not prove authentication works: npm may try to obtain an OIDC token but skips the
  upload), and a `repository` field in `package.json`, which npm provenance requires.
- Switchback experiments (R33, cluster-defined): an experiment with
  `randomizationType: "switchback"` is served by cluster and period through the
  existing `treatment()`, `peek()`, `variableValue()` and `peekVariableValue()`,
  matching the collector and java-sdk. `ExperimentData` gains the optional
  `randomizationType`, `switchbackClusters`, `switchbackClusterValues`,
  `switchbackStartAt`, `switchbackPeriodMs`, `switchbackCarryoverDurationMs`,
  `switchbackBurnInDurationMs`, `switchbackBurnOutDurationMs`,
  `switchbackDesignType` and `switchbackEstimand` fields. There is no new method
  or option. See [Switchback Experiments](README.md#switchback-experiments).
- Known limitation: JavaScript cannot tell `3.0` from `3`, so a cluster
  attribute set to an integral float is keyed like the integer (`"3"`), where
  other SDKs give a float no cluster value. A cluster map with two or more
  linked unit types, one named like an array index (`"1"`), cannot keep its
  declared order in JavaScript, so it is served as an ineligible control
  (variant 0, no exposure).

### Changed

- Switchback experiments that are already running change assignment for this
  SDK: before, they were served as a sticky unit assignment on their `unitType`
  (or not at all), which did not follow the switchback schedule. Now each unit
  gets its cluster's scheduled variant for the current period unless an
  override, assignment rule, strict audience mismatch, full-on setting, a
  not-yet-started schedule (control, no exposure), a traffic miss or
  `customAssignment()` decides it first (see Switchback Experiments in the
  README for the exact order), and exposures are recorded once per period under
  the serving unit, while that period's assignment stays cached. Who moves:
  customers who run switchback experiments. The switchback support itself does
  not change unit experiments or context data without switchbacks; the separate
  shared-variable-key fix can change their variable reads.
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
- `variableValue()` no longer queues an exposure for an experiment the unit is not
  in (strict audience mismatch, or no unit for its unit type), even when that is
  the only experiment defining the key; 1.13.4 published one with
  `assigned: false`. Affected: anyone counting those exposures from variable
  reads of strict-audience or unit-gated experiments. Call `treatment()` to record
  them. Conversely, a winning experiment whose overridden, custom or full-on variant
  is out of range is now exposed with that variant (1.13.4 recorded nothing), as
  in the Java SDK. See the shared variable keys entry under Fixed.
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
- Each read now also checks the assignment-rule, holdout and missing-unit state.
  Measured on Node 22 (synthetic warmed loops, independent reviews on shared
  hosts, approximate): a cached `peek` or `treatment` costs about 2–5 ns more than
  1.13.4. Re-evaluating an audience after `setAttribute`
  matches 1.13.4 with 300 attributes and is about 6% slower with 1,000 and 10% slower
  with 3,000. `getAttributes()` is faster than 1.13.4. A default `track()` +
  `publish()` matches 1.13.4 up to a few hundred attributes (7.3 vs 7.1 µs at 300)
  and costs about 30% more at 3,000 (about 52 vs 40 µs; unreleased main was about
  77 µs). The new opt-in `includeSystemAttributes` adds about 10% on top. A
  cached `variableValue()` or `peekVariableValue()` (four experiments sharing a
  key) costs about 21–26 ns, down from about 155 ns in 1.13.4 and about 65 ns on
  unreleased main, and no longer allocates; a cached `treatment()` or `peek()`
  costs about 1 ns more than unreleased main (the assignment-rule and holdout
  checks above). Measured on shared hosts (Node 22, compiled CJS), so treat these
  as approximate.

### Fixed

- Shared variable keys now pick and expose one experiment, as the Java SDK does.
  Previously `variableValue()` exposed every experiment it checked that had the
  key, including ones the unit was not in (for example a strict audience
  mismatch), which recorded users in experiments they never saw. The wrong
  experiment could also win: when the first experiment's selected variant lacked
  the key, a later experiment's value was served and exposed, so which
  experiment a unit was counted in depended on its arm, biasing the result. Rule
  now applied: candidates are the experiments defining the key in any variant,
  by experiment id ascending; the winner is the first one the unit is in
  (assigned, overridden or rule-assigned), whatever its arm. Its selected
  variant's value is returned (`null`, `false`, `0` and `""` included), or the
  caller default if that variant lacks the key. With no winner, a held-out
  candidate supplies its control value, otherwise the caller default. Only the
  winner is exposed (a silent switchback winner, before its schedule starts or
  with an ineligible cluster, returns control and records nothing); each checked
  candidate's applicable holdouts still fire, as in Java. All exposures of one
  `variableValue()` or `treatment()` call are queued before that call's
  `exposure` and `error` callbacks run (including an audience `error` raised
  while `treatment()` assigns), so a callback that calls `finalize()` still
  sends them. Callbacks a callback raises are replayed after the ones already
  held, in queue order; once a replay has run a bounded number of rounds or
  callbacks, each later call delivers its own callbacks as soon as all of its
  exposures are queued, so runaway logger feedback stays bounded in memory and
  each call still sends its whole batch. A logger that keeps calling
  `treatment()` or `variableValue()` without end still overflows the stack, as
  in 1.13.4; the SDK now catches the overflow in the logger instead of throwing
  it out of the call, and the context stays usable. `peekVariableValue()`
  exposes nothing. A cached assignment or switchback slot whose arm a refresh
  removes returns the caller default (1.13.4 kept serving the removed arm's
  value) and gets the arm's values back if a later refresh restores it. Keys no
  experiment defines return the default again, as in 1.13.4, including names
  like `toString`; a variant config that defines such a key (`toString`,
  `constructor`, `__proto__`) no longer fails the context. Affected: anyone with
  two or more running experiments sharing a variable key. `variableKeys()` keeps
  its map-of-lists return shape.
- Failed publishes retain queued events in order; failed finalize stays open and
  can be retried. Concurrent flush/finalize waits for in-flight delivery.
- Custom publisher failures and throwing event loggers no longer strand lifecycle
  promises or lose/duplicate successfully delivered events. Affected: an event logger
  that throws on `ready` used to mark the context failed in 1.13.4, so every user got
  control and nothing was exposed; such a context now becomes ready and serves real
  variants and exposures.
- Malformed variant configs are isolated rather than failing the entire context.
- The browser bundle is ES5 again and starts in IE 10 with only a Promise polyfill:
  the lockfile pins `rfdc` 1.3.1 (the dependency range is still `^1.3.0`), since
  1.4 ships ES2015 syntax and needs `Map`/`Set` when it loads. `rfdc` is still
  transpiled, and the build fails if `dist/` is not ES5 or does not start without
  native `Map`/`Set`.
- Query keys are encoded and unmatched query surrogates no longer throw URIError.
- The bundled `AbortController` shim matches the native one: a second `abort()` is
  a no-op (listeners fire once) and `signal.reason` is set.
- `fetch` is detected through `globalThis` as well as `window`/`self`/`global`, and
  a missing implementation now throws "No fetch implementation found" instead of an
  undefined-call TypeError.
