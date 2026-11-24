# ABsmartly JavaScript SDK [![npm version](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk.svg)](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk)

A/B Smartly - JavaScript SDK. This is the official isomorphic JavaScript SDK for the [A/B Smartly](https://www.absmartly.com/) A/B testing platform, compatible with both Node.js and browser environments.

## Compatibility

The A/B Smartly JavaScript SDK is an isomorphic library for Node.js (CommonJS and ES6) and browsers (UMD).

- **Node.js**: Version 6.x and npm 3.x or later
- **Browsers**: IE 10+ and all modern browsers (Chrome, Firefox, Safari, Edge)

**Note**: IE 10 does not natively support Promises. If you target IE 10, you must include a polyfill like [es6-promise](https://www.npmjs.com/package/es6-promise) or [rsvp](https://www.npmjs.com/package/rsvp).

## Installation

### npm

```shell
npm install @absmartly/javascript-sdk --save
```

### Import in your JavaScript application

```javascript
const absmartly = require("@absmartly/javascript-sdk");

// OR with ES6 modules:
import absmartly from "@absmartly/javascript-sdk";
```

### Directly in the browser

You can include an optimized and pre-built package directly in your HTML code through [unpkg.com](https://www.unpkg.com).

Simply add the following code to your `head` section to include the latest published version.

```html
<script src="https://unpkg.com/@absmartly/javascript-sdk/dist/absmartly.min.js"></script>
```

## Getting Started

Please follow the [installation](#installation) instructions before trying the following code.

### Initialization

This example assumes an API Key, an Application, and an Environment have been created in the A/B Smartly web console.

```javascript
const sdk = new absmartly.SDK({
    endpoint: "https://your-company.absmartly.io/v1",
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: process.env.APPLICATION_NAME,
});
```

The `application` option can also be an object with `name` and `version` to track which version of your application is generating events. The version can be a number or a semver string:
```javascript
const sdk = new absmartly.SDK({
    endpoint: 'https://sandbox.absmartly.io/v1',
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: { name: 'website', version: '1.2.3' },
});
```

**SDK Options**

| Option       | Type       | Required? | Default | Description                                                                                                                                                                 |
| :----------- | :--------- | :-------: | :-----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| endpoint     | `string`   |  &#9989;  | `null`  | The URL to your API endpoint. Most commonly `"your-company.absmartly.io"`                                                                                                   |
| apiKey       | `string`   |  &#9989;  | `null`  | Your API key which can be found on the Web Console.                                                                                                                         |
| environment  | `string`   |  &#9989;  | `null`  | The environment of the platform where the SDK is installed. Environments are created on the Web Console and should match the available environments in your infrastructure. |
| application  | `string`   |  &#9989;  | `null`  | The name of the application where the SDK is installed. Applications are created on the Web Console and should match the applications where your experiments will be running.|
| retries      | `number`   | &#10060;  | `5`     | Number of retry attempts for failed HTTP requests.                                                                                                                          |
| timeout      | `number`   | &#10060;  | `3000`  | HTTP request timeout in milliseconds.                                                                                                                                       |
| eventLogger  | `function` | &#10060;  | `null`  | Callback to handle SDK events (ready, exposure, goal, etc.)                                                                                                                 |

#### Creating a new Context with raw promises
```javascript
const request = {
    units: {
        session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
    },
};

const context = sdk.createContext(request);

context.ready().then(() => {
    console.log("ABsmartly Context ready!");
    if (context.isFailed()) {
        console.error("ABsmartly Context failed:", context.readyError());
    }

    const treatment = context.treatment("exp_test");
});
```

### With async/await

```javascript
const request = {
    units: {
        session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
    },
};

const context = sdk.createContext(request);

await context.ready();
if (context.isFailed()) {
    console.error("ABsmartly Context failed:", context.readyError());
}

const treatment = context.treatment("exp_test");
```

### With Pre-fetched Data

When doing full-stack experimentation with A/B Smartly, we recommend creating a context only once on the server-side. Creating a context involves a round-trip to the A/B Smartly event collector. We can avoid repeating the round-trip on the client-side by sending the server-side data embedded in the first document, for example, by rendering it on the template. Then we can initialize the A/B Smartly context on the client-side directly with it.

```html
<head>
    <script>
        const request = {
            units: {
                session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
            },
        };

        const context = sdk.createContextWith(request, {{ serverSideContext.data() }});
    </script>
</head>
```

### Refreshing the Context with Fresh Experiment Data

For long-running single-page-applications (SPA), the context is usually created once when the application is first reached. However, any experiments being tracked in your production code, but started after the context was created, will not be triggered. To mitigate this, we can use the `refreshPeriod` option when creating the context.

```javascript
const request = {
    units: {
        session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
    },
};

const context = sdk.createContext(request, {
    refreshPeriod: 5 * 60 * 1000, // 5 minutes
});
```

Alternatively, the `refresh()` method can be called manually. The `refresh()` method pulls updated experiment data from the A/B Smartly collector and will trigger recently started experiments when `treatment()` is called again.

```javascript
setTimeout(async () => {
    try {
        await context.refresh();
    } catch (error) {
        console.error(error);
    }
}, 5 * 60 * 1000);
```

### Setting Extra Units

You can add additional units to a context by calling the `unit()` or the `units()` method. This is useful when a user logs in to your application and you want to add the new unit type to the context.

> **Note:** You cannot override an already set unit type as that would be a change of identity. In this case, you must create a new context instead.

The `unit()` and `units()` methods can be called before the context is ready.

```javascript
context.unit("db_user_id", 1000013);

context.units({
    db_user_id: 1000013,
});
```

## Basic Usage

### Selecting a Treatment

#### Including system attributes
You can opt in to also send the SDK name and version with every publish. These are sent as context attributes and can be useful for debugging and filtering in the Web Console.

To enable this, set the `includeSystemAttributes` option to `true` when creating the context:
```javascript
const context = sdk.createContext(request, {
    includeSystemAttributes: true,
});
```

When enabled, the following attributes are prepended to the publish request payload:

| Attribute | Description |
|:--- |---|
| `sdk_name` | The SDK agent name (e.g. `"absmartly-javascript-sdk"`) |
| `sdk_version` | The SDK version (e.g. `"1.14.0"`) |

Their `setAt` is the time of the earliest exposure or goal in the publish, so they apply to every event in it. A system attribute is not sent when you set an attribute with the same name yourself, so your value is kept.

The application and environment names are not part of this option: the collector already adds them to every event, and the SDK always uses them for audiences (see [Context Attributes](#context-attributes)).

#### Selecting a treatment
```javascript
if (context.treatment("exp_test_experiment") === 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group
}
```

### Treatment Variables

Variables allow you to configure experiment variations without code changes.

```javascript
const defaultButtonColor = "red";
const buttonColor = context.variableValue("button.color", defaultButtonColor);
```

#### Shared variable keys

When several experiments define the same variable key, the SDK checks them in
ascending experiment id and uses the first one the user is in (assigned,
overridden or assigned by a rule). Its variant's value is returned, or your
default if that variant does not define the key; later experiments are never
used instead. If the user is in none of them but one is held out by a holdout,
that experiment's control value is returned. Only the winning experiment gets an
exposure (plus any holdouts covering the experiments checked); a held-out
experiment that supplies its control value records only its holdout's exposure.
An experiment the user is not in, such as a strict audience mismatch, gets none;
call `treatment()` to record it. A switchback that wins but is silent (before
its schedule starts, or with an ineligible cluster) returns its control value
and records nothing, and later experiments are still not used.
`peekVariableValue()` never queues an exposure.

### Peek at Treatment Variants

Although generally not recommended, it is sometimes necessary to peek at a treatment without triggering an exposure. The A/B Smartly SDK provides a `peek()` method for that.

```javascript
if (context.peek("exp_test_experiment") === 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group
}
```

#### Peeking at Variable Values

```javascript
const buttonColor = context.peekVariableValue("button.color", "red");
```

### Overriding Treatment Variants

During development, it is useful to force a treatment for an experiment. This can be achieved with the `override()` and/or `overrides()` methods. The `override()` and `overrides()` methods can be called before the context is ready.

```javascript
context.override("exp_test_experiment", 1); // force variant 1

context.overrides({
    exp_test_experiment: 1,
    exp_another_experiment: 0,
});
```

### Switchback Experiments

A switchback experiment randomizes *clusters* over time instead of units. A cluster is a value of a context attribute, for example a store's region. Every unit in the same cluster sees the same variant during a period, and the variant changes on a fixed time grid. There is nothing new to call: `treatment()`, `peek()`, `variableValue()` and `peekVariableValue()` serve switchback experiments, and the A/B Smartly collector sends their configuration with the context data.

```javascript
context.units({ store_id: "store-1234" });
// The experiment links the store_id unit type to the attribute path "region".
context.attribute("region", "lisbon");

const variant = context.treatment("exp_delivery_fee"); // the "lisbon" cluster's variant for this period
```

How a switchback is served (the contract the A/B Smartly collector serves; java-sdk implements the same):

- **Cluster.** The experiment lists linked unit types, each with an attribute path, in a significant order. For each linked type the context has a unit of, in that order, the SDK reads the attribute at the path. The first unit that gives a value serves, and its value is the cluster key. If a later unit gives a different value, the cluster is ineligible.
- **Values.** A non-empty string is used as-is, and a whole number below `1e21` in magnitude as its decimal text (`17` and `"17"` are the same cluster). Numbers beyond `Number.MAX_SAFE_INTEGER` lose precision in JavaScript before the SDK sees them, so set large identifiers as strings. Fractions, booleans, objects, arrays, empty strings and `null` give no value. **JavaScript cannot tell `3.0` from `3`**, so a number written as `3.0` is the cluster `"3"`, like the integer; other SDKs give a float no value. Set cluster attributes as strings or integers. A cluster map whose unit type names look like array indexes (`"1"`, `"2"`) cannot keep its order in JavaScript, so with two or more linked types such an experiment is served as an ineligible control.
- **Paths.** `/` separates segments (`profile/region`, `items/0/region`), a quoted segment is a literal key (`'a/b'`), and an unquoted number indexes an array. An index must be non-negative and sit between two key segments (`items/0` and `items/0/1/region` are unreadable). A `.` anywhere makes the path unreadable: nest with `/`. The first segment names an attribute set with `attribute()`; the value read is the latest one set at or before the call.
- **No linked unit:** the experiment does not apply (variant 0, nothing recorded; a variable lookup returns its default), though an `override()` still applies and is recorded. **Ineligible cluster** (no value, units disagree, or a value outside the experiment's allowed values): variant 0 and no exposure, unless an `override()` is set, which still applies and is recorded under the first linked unit present. **Unreadable cluster map** (missing, empty or with an unreadable path): an ineligible control when the context has a unit of the experiment's `unitType`, otherwise the experiment does not apply.
- **Precedence** for an eligible cluster: `override()`, then assignment rules (a `split` rule randomizes over the serving unit), a strict audience mismatch (variant 0, recorded), full-on, then the schedule. Before the schedule starts, or when it cannot be served, the result is variant 0 with no exposure. Then traffic (on the serving unit; a miss is recorded as not eligible), `customAssignment()`, and the schedule draw over the cluster key. **Holdouts never apply to switchback experiments.**
- **Exposures.** One exposure per experiment and period while that period's assignment stays cached, under the serving unit's type, with the same fields as any other exposure. As for other experiments, an assignment that is resolved again within the period (after a refresh or an attribute change alters its outcome, or a clock moved back past the two retained periods) records another exposure. Its `exposedAt` is the time at which the call chose the period. While the period's assignment stays cached, the cluster is read once: a later `attribute()` in the same period does not move the unit to another cluster, and the next period reads the attributes afresh. A clock moved back past the two retained periods reads the cluster afresh too, and can select a different cluster. Attributes are published as usual; the collector reads the cluster from them. On a variable key shared with other experiments, a switchback follows the same rule as unit experiments (see [Shared variable keys](#shared-variable-keys)): only the winner is exposed, so a strict-mismatched switchback checked before the winner records nothing.

The schedule follows the device clock (`Date.now()`), so a device whose clock is wrong is served another period's variant.

## Advanced

### Context Attributes

Attributes are used to pass meta-data about the user and/or the request. They can be used later in the Web Console to create segments or audiences. They can be set using the `attribute()` or `attributes()` methods, before or after the context is ready.

```javascript
context.attribute("user_agent", navigator.userAgent);

context.attributes({
    customer_age: "new_customer",
});
```

Audience filters and assignment-rule conditions can also use `application` and `environment`, the application and environment names configured in the SDK. They are always available, but they are not real attributes: they are not published (the collector adds them on its side) and `getAttributes()` doesn't return them. Names that are not configured or empty are left out. An attribute you set with the same name, at any time, takes precedence:

```javascript
context.attribute("environment", "staging"); // audiences now see "staging"
```

### Custom Assignments

Sometimes it may be necessary to override the automatic selection of a variant. For example, if you wish to have your variant chosen based on data from an API call. This can be accomplished using the `customAssignment()` method.

```javascript
context.customAssignment("exp_test_experiment", 1);

context.customAssignments({
    exp_test_experiment: 1,
});
```

### Tracking Goals

Goals are created in the A/B Smartly web console.

```javascript
context.track("payment", { item_count: 1, total_amount: 1999.99 });
```

### Publishing Pending Data

Sometimes it is necessary to ensure all events have been published to the A/B Smartly collector, before proceeding.
One such case is when the user is about to navigate away right before being exposed to a treatment.
You can explicitly call the `publish()` method, which returns a promise, before navigating away.
```javascript
await context.publish().then(() => {
    window.location = "https://www.absmartly.com"
})
```

#### Finalizing
The `finalize()` method will ensure all events have been published to the A/B Smartly collector, like `publish()`, and will also "seal" the context, throwing an error if any method that could generate an event is called.
```javascript
await context.finalize().then(() => {
    window.location = "https://www.absmartly.com"
})
```

#### Refreshing the context with fresh experiment data
For long-running single-page-applications (SPA), the context is usually created once when the application is first reached.
However, any experiments being tracked in your production code, but started after the context was created, will not be triggered.
To mitigate this, we can use the `refreshPeriod` option when creating the context.

```javascript
const request = {
    units: {
        session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8',
    },
};

const context = sdk.createContext(request, {
    refreshPeriod: 5 * 60 * 1000
});
```

### Using a Custom Event Logger

The A/B Smartly SDK can be instantiated with an event logger used for all contexts. In addition, an event logger can be specified when creating a particular context, in the `createContext` call options. The example below illustrates this with the implementation of the default event logger, used if none is specified.

```javascript
const sdk = new absmartly.SDK({
    endpoint: "https://your-company.absmartly.io/v1",
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: process.env.APPLICATION_NAME,
    eventLogger: (context, eventName, data) => {
        if (eventName === "error") {
            console.error(data);
        }
    },
});
```

**Event Types**

The data parameter depends on the type of event. Currently, the SDK logs the following events:

| Event        | When                                              | Data                                          |
| :----------- | :------------------------------------------------ | :-------------------------------------------- |
| `"error"`    | Context receives an error                         | Error object thrown                           |
| `"ready"`    | Context turns ready                               | Data used to initialize the context           |
| `"refresh"`  | `refresh()` method succeeds                       | Data used to refresh the context              |
| `"publish"`  | `publish()` method succeeds                       | Data sent to the A/B Smartly event collector  |
| `"exposure"` | `treatment()` method succeeds on first exposure   | Exposure data enqueued for publishing         |
| `"goal"`     | `track()` method succeeds                         | Goal data enqueued for publishing             |
| `"finalize"` | `finalize()` method succeeds the first time       | undefined                                     |

`"exposure"` and `"error"` events raised by one `variableValue()` call (and the
`"exposure"` events of one `treatment()` call) are delivered after all of that
call's exposures are queued, in the order they were raised, so a logger that
calls `publish()` or `finalize()` sends every one of them. Events a logger
triggers itself are delivered after the ones already waiting.

### HTTP Request Timeout

It is possible to set a timeout per individual HTTP request, overriding the global timeout set for all requests when instantiating the SDK object.

Here is an example of setting a timeout only for the `createContext` request.

```javascript
const context = sdk.createContext(request, {
    refreshPeriod: 5 * 60 * 1000
}, {
    timeout: 1500,
});
```

### HTTP Request Cancellation

Sometimes it is useful to cancel an inflight HTTP request, for example, when the user is navigating away. The A/B Smartly SDK supports cancellation via an `AbortSignal`. An implementation of AbortController is provided for older platforms, but will use the native implementation where available.

Here is an example of a cancellation scenario.

```javascript
const controller = new absmartly.AbortController();
const context = sdk.createContext(request, {
    refreshPeriod: 5 * 60 * 1000
}, {
    signal: controller.signal,
});

// abort request if not ready after 1500ms
const timeoutId = setTimeout(() => controller.abort(), 1500);

await context.ready();

clearTimeout(timeoutId);
```

## Node.js Usage

### Express.js Middleware Example

```javascript
const absmartly = require("@absmartly/javascript-sdk");

const sdk = new absmartly.SDK({
    endpoint: "https://your-company.absmartly.io/v1",
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: "production",
    application: "website",
});

app.use(async (req, res, next) => {
    const context = sdk.createContext({
        units: {
            session_id: req.cookies.session_id,
        },
    });

    await context.ready();
    if (context.isFailed()) {
        console.error("ABsmartly context failed:", context.readyError());
    }
    req.absmartly = context;
    next();
});

app.get("/landing", (req, res) => {
    const context = req.absmartly;
    const treatment = context.treatment("exp_landing_page");

    if (treatment === 0) {
        res.render("landing-control");
    } else {
        res.render("landing-treatment");
    }
});
```

### Server-Side Rendering (SSR) with Data Forwarding

Create the context on the server and pass the data to the client to avoid a second round-trip.

```javascript
app.get("/", async (req, res) => {
    const context = sdk.createContext({
        units: { session_id: req.cookies.session_id },
    });

    await context.ready();

    const contextData = context.data();
    const treatment = context.treatment("exp_homepage");

    res.render("index", {
        treatment,
        absmartlyData: JSON.stringify(contextData),
    });
});
```

On the client side, initialize the context with the pre-fetched data:

```javascript
const context = sdk.createContextWith(
    { units: { session_id: sessionId } },
    JSON.parse(window.__ABSMARTLY_DATA__)
);
// context is immediately ready, no round-trip needed
```

## Browser Usage

### Single-Page Application (SPA) Example

```javascript
import absmartly from "@absmartly/javascript-sdk";

const sdk = new absmartly.SDK({
    endpoint: "https://your-company.absmartly.io/v1",
    apiKey: "YOUR_API_KEY",
    environment: "production",
    application: "website",
    eventLogger: (context, eventName, data) => {
        if (eventName === "exposure") {
            analytics.track("Experiment Viewed", {
                experiment: data.name,
                variant: data.variant,
            });
        }
    },
});

const context = sdk.createContext({
    units: {
        session_id: getUserSessionId(),
    },
});

await context.ready();

const showNewFeature = context.treatment("exp_new_feature") !== 0;

if (showNewFeature) {
    renderNewFeature();
} else {
    renderOldFeature();
}

document.getElementById("checkout-btn").addEventListener("click", () => {
    context.track("checkout", { total: getCartTotal() });
});
```

## Migration Guide (1.13.x → 1.14.0)

Version 1.14.0 contains a few breaking changes. Most applications will not need code changes, but review the items below.

### `ready()` no longer resolves with the Error object on failure

**Before:** `ready()` resolved with the Error object on failure (e.g., `const result = await context.ready()` would give you the Error).

**After:** `ready()` always resolves with `true`. It is a "wait for initialization" signal — you should always proceed with experiment code after it settles, even on failure. The SDK returns control variants (`0`) and default values gracefully when the API is down. Use `isFailed()` and `readyError()` to check for errors if needed.

```javascript
await context.ready();
if (context.isFailed()) {
    console.error("Context failed:", context.readyError());
}
const variant = context.treatment("exp_test"); // returns 0 (control) on failure
```

**When this might be a problem:** If your code used the return value as the Error object (e.g., `const err = await context.ready(); logError(err)`), it will now receive `true` instead. Use `context.readyError()` to access the error instead.

### Unit IDs containing astral characters now hash to canonical UTF-8

**Before:** `stringToUint8Array` (used to hash unit IDs for variant assignment) encoded each UTF-16 code unit independently. A character outside the Basic Multilingual Plane (≥ U+10000, e.g. an emoji) was encoded as an invalid CESU-8 byte sequence rather than canonical UTF-8.

**After:** Unit IDs are encoded as canonical 4-byte UTF-8, matching the A/B Smartly collector (which hashes with `UTF_8`).

**When this might be a problem:** A unit ID that contains an astral character (emoji, rare CJK, etc.) may now be assigned a **different variant** than it was in earlier versions. **Unit IDs composed entirely of BMP characters (≤ U+FFFF) — which covers essentially all typical session IDs, UUIDs, and user IDs — are unaffected.** This only changes assignment for units whose IDs contain astral characters.

### `audienceMismatch` cache invalidation on indeterminate audiences

When an audience cannot be evaluated to a boolean (a malformed or non-boolean filter), the cached assignment's `audienceMismatch` flag is now left unchanged instead of being reset to `false`. This keeps a previously valid cached assignment from being needlessly invalidated. Assignment results for well-formed audiences are unchanged.

An audience filter that throws while being evaluated is treated as a mismatch, so with `audienceStrict` the unit gets variant 0.

### Audiences always see `application` and `environment`; the automatic `app_version` is gone

**Before:** audience filters and assignment-rule conditions saw only the attributes you set (and, in pre-releases of 1.14.0, `application`, `environment` and `app_version` when `includeSystemAttributes` was on). The Web Console offers `application` and `environment` as attributes because the collector adds them to every event, but the SDK never had them, so a condition on either evaluated against a missing value and never matched.

**After:** the SDK always evaluates audiences and assignment-rule conditions with `application` and `environment` set to the names configured in the SDK. An attribute you set with the same name, at any time, overrides them. Names that are not configured or empty are left out. They are not published. The SDK no longer adds `app_version` for audiences or rules (one you set yourself with `context.attribute("app_version", ...)` is still used and published like any other attribute), and `includeSystemAttributes` now only adds `sdk_name` and `sdk_version` to the publish payload; the option is still accepted.

**This changes assignment for running experiments.** In an experiment with Audience enforced (`audienceStrict`) and an `environment` or `application` condition, a unit whose context does not set that attribute itself currently gets variant 0, even when the configured name matches the condition and even when the experiment is full-on. After upgrading, such a unit is randomised normally (or gets the full-on variant) when the configured name matches. Those units are misassigned today; this release fixes them, but their exposures will change. An attribute your context sets itself still overrides the configured name, so its matching does not change. This protection is per attribute: if an audience uses both `application` and `environment` and the context sets only one of them, the configured name for the other can still change the result. An audience or rule on `app_version` no longer matches unless you set `app_version` yourself.

### Switchback experiments are served

**Before:** this SDK ignored the switchback fields the collector sends. A switchback experiment was served as a sticky unit assignment on its `unitType` (or not at all without one), so its exposures did not follow the switchback schedule.

**After:** switchback experiments are served by cluster and period, as described in [Switchback Experiments](#switchback-experiments). **This changes assignment for switchback experiments that are already running**: their units move from the sticky unit assignment to the cluster's schedule, and exposures are recorded once per period (while the period's assignment stays cached) under the serving unit. The switchback support itself does not change unit experiments or context data without switchbacks; see [Shared variable keys](#shared-variable-keys-pick-and-expose-one-experiment) below for the separate variable-read fix.

### Shared variable keys pick and expose one experiment

**Before:** when several experiments defined the same variable key, `variableValue()` exposed every experiment it checked, including ones the user was not in (for example a strict audience mismatch), and when the first experiment's variant lacked the key it served and exposed a later experiment's value instead.

**After:** the first experiment by id that the user is in (assigned, overridden or rule-assigned) wins whatever its variant, as in the Java SDK; its variant's value is returned, or your default if that variant lacks the key. Only that experiment is exposed, unless it is a silent switchback (before its schedule starts, or with an ineligible cluster), which returns control and records nothing (see [Shared variable keys](#shared-variable-keys)). **This changes served values and exposures** for users whose winning experiment's variant lacks the key, and removes exposures that `variableValue()` used to record for experiments the user is not in; call `treatment()` if you need those recorded.

## About A/B Smartly

**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them. A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk) (this package)
- [React SDK](https://www.github.com/absmartly/react-sdk)
- [Vue2 SDK](https://www.github.com/absmartly/vue2-sdk)
- [Vue3 SDK](https://www.github.com/absmartly/vue3-sdk)
- [Java SDK](https://www.github.com/absmartly/java-sdk)
- [Swift SDK](https://www.github.com/absmartly/swift-sdk)
- [Flutter SDK](https://www.github.com/absmartly/flutter-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
- [Python3 SDK](https://www.github.com/absmartly/python3-sdk)
- [Go SDK](https://www.github.com/absmartly/go-sdk)
- [Ruby SDK](https://www.github.com/absmartly/ruby-sdk)
- [.NET SDK](https://www.github.com/absmartly/dotnet-sdk)
