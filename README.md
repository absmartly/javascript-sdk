# A/B Smartly SDK [![npm version](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk.svg)](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk)

A/B Smartly - JavaScript SDK

## Compatibility

The A/B Smartly JavaScript SDK is an isomorphic TypeScript library for Node.js (ESM and CommonJS) and browsers (IIFE).

### Modern (default, zero dependencies)
- **Node.js 18+** - uses native `fetch` and `AbortController`
- **All modern browsers** - Chrome, Firefox, Safari, Edge

### Legacy Node.js (14-17)
Supported via optional polyfill injection. No extra dependencies are bundled - you provide your own:

```typescript
import fetch from "node-fetch";
import { AbortController } from "abort-controller";

const sdk = new SDK({
    endpoint: "https://sandbox.absmartly.io/v1",
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: "production",
    application: "website",
    fetchImpl: fetch,
    AbortControllerImpl: AbortController,
});
```

### Legacy Browsers
A pre-built legacy bundle transpiled to ES2015 is available at `dist/index.legacy.js`.

**Important:** This is an ES2015 build, not an ES5 build. It can help with older browsers that support ES2015, but it does **not** restore IE11 or IE10 compatibility on its own.

If you need legacy browser support, you must provide polyfills for missing APIs:

| API | Polyfill |
|---|---|
| `Promise` | [es6-promise](https://www.npmjs.com/package/es6-promise) |
| `fetch` | [whatwg-fetch](https://www.npmjs.com/package/whatwg-fetch) |
| `AbortController` | [abortcontroller-polyfill](https://www.npmjs.com/package/abortcontroller-polyfill) |

```html
<!-- Polyfills (only needed for legacy browsers) -->
<script src="https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3/dist/fetch.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/abortcontroller-polyfill@1/dist/abortcontroller-polyfill-only.js"></script>

<!-- SDK (legacy build) -->
<script src="https://unpkg.com/@absmartly/javascript-sdk/dist/index.legacy.js"></script>
```

### Build Outputs

| File | Target | Use case |
|---|---|---|
| `dist/index.js` | ES2022 ESM | Modern bundlers (Vite, webpack, Rollup) |
| `dist/index.cjs` | ES2022 CJS | Node.js `require()` |
| `dist/index.global.js` | ES2022 IIFE | Modern browsers via `<script>` tag |
| `dist/index.legacy.js` | ES2015 IIFE | Older browsers that already support ES2015 syntax |
| `dist/index.d.ts` | TypeScript | Type declarations |

## Installation

#### npm

```shell
npm install @absmartly/javascript-sdk --save
```

#### Import in your application
```typescript
import { SDK } from "@absmartly/javascript-sdk";

// Or with CommonJS:
const { SDK } = require("@absmartly/javascript-sdk");
```

#### Directly in the browser (modern)
```html
<script src="https://unpkg.com/@absmartly/javascript-sdk/dist/index.global.js"></script>
<script>
    const { SDK } = absmartly;
</script>
```

#### Directly in the browser (legacy / ES2015-capable browsers)
```html
<!-- Include polyfills first (see Legacy Browsers section above) -->
<script src="https://unpkg.com/@absmartly/javascript-sdk/dist/index.legacy.js"></script>
<script>
    const SDK = absmartly.SDK;
</script>
```

## Getting Started

Please follow the [installation](#installation) instructions before trying the following code:

#### Initialization
This example assumes an Api Key, an Application, and an Environment have been created in the A/B Smartly web console.
```typescript
const sdk = new SDK({
    endpoint: "https://sandbox.absmartly.io/v1",
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: process.env.APPLICATION_NAME,
});
```

The `application` option can also be an object with `name` and `version` to track which version of your application is generating events. The version can be a number or a semver string:
```typescript
const sdk = new SDK({
    endpoint: "https://sandbox.absmartly.io/v1",
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: { name: "website", version: "1.2.3" },
});
```

#### SDK Options

| Option | Type | Required | Description |
|---|---|---|---|
| `endpoint` | `string` | Yes | A/B Smartly API endpoint |
| `apiKey` | `string` | Yes | API key from the web console |
| `environment` | `string` | Yes | Environment name (e.g. `"production"`) |
| `application` | `string \| { name, version }` | Yes | Application name or object |
| `agent` | `string` | No | Custom agent identifier |
| `retries` | `number` | No | Number of retries (default: `5`) |
| `timeout` | `number` | No | Request timeout in ms (default: `3000`) |
| `keepalive` | `boolean` | No | Enable keep-alive (default: `true`) |
| `fetchImpl` | `typeof fetch` | No | Custom fetch implementation for legacy environments |
| `AbortControllerImpl` | `typeof AbortController` | No | Custom AbortController for legacy environments |

#### Creating a new Context with promises
```typescript
const context = sdk.createContext({
    units: {
        session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
    },
});

context.ready().then(() => {
    console.log("ABSmartly Context ready!");
}).catch((error) => {
    console.log(error);
});
```

#### Creating a new Context with async/await
```typescript
const context = sdk.createContext({
    units: {
        session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
    },
});

try {
    await context.ready();
    console.log("ABSmartly Context ready!");
} catch (error) {
    console.log(error);
}
```

#### Creating a new Context with pre-fetched data
When doing full-stack experimentation with A/B Smartly, we recommend creating a context only once on the server-side.
Creating a context involves a round-trip to the A/B Smartly event collector.
We can avoid repeating the round-trip on the client-side by sending the server-side data embedded in the first document, for example, by rendering it on the template.
Then we can initialize the A/B Smartly context on the client-side directly with it.

```html
<head>
    <script type="javascript">
        const context = sdk.createContextWith(
            { units: { session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8" } },
            {{ serverSideContext.data() }}
        );
    </script>
</head>
```

#### Setting extra units for a context
You can add additional units to a context by calling the `unit()` or the `units()` method.
This method may be used for example, when a user logs in to your application, and you want to use the new unit type to the context.
Please note that **you cannot override an already set unit type** as that would be a change of identity, and will throw an exception. In this case, you must create a new context instead.
The `unit()` and `units()` methods can be called before the context is ready.

```typescript
context.unit("db_user_id", 1000013);

// or
context.units({
    db_user_id: 1000013,
});
```

#### Setting context attributes
The `attribute()` and `attributes()` methods can be called before the context is ready.
```typescript
context.attribute("user_agent", navigator.userAgent);

context.attributes({
    customer_age: "new_customer",
});
```

#### Including system attributes
You can opt in to automatically include system attributes (SDK name, SDK version, application, environment, and application version) in every publish payload. These are sent as context attributes and can be useful for debugging and filtering in the Web Console.

To enable this, set the `includeSystemAttributes` option to `true` when creating the context:
```typescript
const context = sdk.createContext(request, {
    includeSystemAttributes: true,
});
```

When enabled, the following attributes are automatically prepended to the publish request payload:

| Attribute | Description |
|:---|---|
| `sdk_name` | The SDK agent name (e.g. `"absmartly-javascript-sdk"`) |
| `sdk_version` | The SDK version (e.g. `"2.0.0"`) |
| `application` | The application name from the SDK configuration |
| `environment` | The environment from the SDK configuration |
| `app_version` | The application version, only included if greater than `0` |

These system attributes are prepended before any user-defined attributes.

#### Selecting a treatment
```typescript
if (context.treatment("exp_test_experiment") === 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group
}
```

#### Tracking a goal achievement
Goals are created in the A/B Smartly web console.
```typescript
context.track("payment", { item_count: 1, total_amount: 1999.99 });
```

#### Publishing pending data
Sometimes it is necessary to ensure all events have been published to the A/B Smartly collector, before proceeding.
One such case is when the user is about to navigate away right before being exposed to a treatment.
You can explicitly call the `publish()` method, which returns a promise, before navigating away.
```typescript
await context.publish();
window.location = "https://www.absmartly.com";
```

#### Finalizing
The `finalize()` method will ensure all events have been published to the A/B Smartly collector, like `publish()`, and will also "seal" the context, throwing an error if any method that could generate an event is called.
```typescript
await context.finalize();
window.location = "https://www.absmartly.com";
```

#### Refreshing the context with fresh experiment data
For long-running single-page-applications (SPA), the context is usually created once when the application is first reached.
However, any experiments being tracked in your production code, but started after the context was created, will not be triggered.
To mitigate this, we can use the `refreshInterval` option when creating the context.

```typescript
const context = sdk.createContext(
    { units: { session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8" } },
    { refreshInterval: 5 * 60 * 1000 },
);
```

Alternatively, the `refresh()` method can be called manually.
The `refresh()` method pulls updated experiment data from the A/B Smartly collector and will trigger recently started experiments when `treatment()` is called again.
```typescript
setTimeout(async () => {
    try {
        await context.refresh();
    } catch (error) {
        console.error(error);
    }
}, 5 * 60 * 1000);
```

#### Using a custom Event Logger
The A/B Smartly SDK can be instantiated with an event logger used for all contexts.
In addition, an event logger can be specified when creating a particular context, in the `createContext` call options.
The example below illustrates this with the implementation of the default event logger, used if none is specified.
```typescript
const sdk = new SDK({
    endpoint: "https://sandbox-api.absmartly.com/v1",
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

The data parameter depends on the type of event.
Currently, the SDK logs the following events:

| eventName | when | data |
|:---:|---|---|
| `"error"` | `Context` receives an error | error object thrown |
| `"ready"` | `Context` turns ready | data used to initialize the context |
| `"refresh"` | `Context.refresh()` method succeeds | data used to refresh the context |
| `"publish"` | `Context.publish()` method succeeds | data sent to the A/B Smartly event collector |
| `"exposure"` | `Context.treatment()` method succeeds on first exposure | exposure data enqueued for publishing |
| `"goal"` | `Context.track()` method succeeds | goal data enqueued for publishing |
| `"finalize"` | `Context.finalize()` method succeeds the first time | undefined |


#### Peek at treatment variants
Although generally not recommended, it is sometimes necessary to peek at a treatment without triggering an exposure.
The A/B Smartly SDK provides a `peek()` method for that.

```typescript
if (context.peek("exp_test_experiment") === 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group
}
```

#### Overriding treatment variants
During development, for example, it is useful to force a treatment for an experiment. This can be achieved with the `override()` and/or `overrides()` methods.
The `override()` and `overrides()` methods can be called before the context is ready.
```typescript
context.override("exp_test_experiment", 1); // force variant 1 of treatment
context.overrides({
    exp_test_experiment: 1,
    exp_another_experiment: 0,
});
```

#### HTTP request timeout
It is possible to set a timeout per individual HTTP request, overriding the global timeout set for all request when instantiating the SDK object.

Here is an example of setting a timeout only for the createContext request.

```typescript
const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000,
}, {
    timeout: 1500,
});
```

#### HTTP Request cancellation
Sometimes it is useful to cancel an inflight HTTP request, for example, when the user is navigating away. The A/B Smartly SDK supports cancellation via an `AbortSignal`.

```typescript
const controller = new AbortController();
const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000,
}, {
    signal: controller.signal,
});

// abort request if not ready after 1500ms
const timeoutId = setTimeout(() => controller.abort(), 1500);

await context.ready();

clearTimeout(timeoutId);
```

## Migration from v1

### Breaking changes
- **Named exports** instead of default export: `import { SDK } from "@absmartly/javascript-sdk"` instead of `import absmartly from "@absmartly/javascript-sdk"`
- **Node.js 14+** minimum (was Node.js 6+)
- **IE10 and IE11 are not supported by the shipped bundles** - `index.legacy.js` is ES2015, not ES5. Supporting IE10/IE11 would require an additional ES5 build plus polyfills.
- **No bundled polyfills** - `core-js`, `node-fetch`, and `rfdc` are no longer bundled. Legacy environments must provide polyfills explicitly.
- **Browser bundle renamed** - `dist/absmartly.min.js` is now `dist/index.global.js` (modern) or `dist/index.legacy.js` (ES2015 legacy build)

### New features
- Full TypeScript support with type declarations
- Zero runtime dependencies
- Optional polyfill injection (`fetchImpl`, `AbortControllerImpl`)
- ESM, CJS, and IIFE builds from a single source
- Smaller bundle size

### Removed exports
- `AbortController` is no longer exported by the SDK package.
- Use the platform/global `AbortController` instead.
- In legacy environments, provide your own polyfill and pass it via `AbortControllerImpl`.

## About A/B Smartly
**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them.
A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [Java SDK](https://www.github.com/absmartly/java-sdk)
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
- [Swift SDK](https://www.github.com/absmartly/swift-sdk)
- [Vue2 SDK](https://www.github.com/absmartly/vue2-sdk)
