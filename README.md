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

### Security Warning: Client-Side Usage

**IMPORTANT:** This SDK exposes your API key when used directly in browser environments. API keys should never be embedded in client-side code as they can be extracted from browser bundles or network requests.

**Recommended Architecture:**
- **DO NOT** use this SDK directly in the browser with your API key
- **DO** use this SDK in Node.js server-side applications
- **DO** create a server-side proxy endpoint that fetches context data on behalf of your frontend
- **DO** use short-lived, per-session tokens instead of API keys for client-side requests

```text
Browser --> Your Server (with API key) --> ABsmartly API
            session token only
```

For production browser applications, contact A/B Smartly support for client-side SDK recommendations.

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

## Creating a New Context

### With Promises

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

For long-running single-page-applications (SPA), the context is usually created once when the application is first reached. However, any experiments being tracked in your production code, but started after the context was created, will not be triggered. To mitigate this, we can use the `refreshInterval` option when creating the context.

```javascript
const request = {
    units: {
        session_id: "5ebf06d8cb5d8137290c4abb64155584fbdb64d8",
    },
};

const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
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

## Advanced

### Context Attributes

Attributes are used to pass meta-data about the user and/or the request. They can be used later in the Web Console to create segments or audiences. They can be set using the `attribute()` or `attributes()` methods, before or after the context is ready.

```javascript
context.attribute("user_agent", navigator.userAgent);

context.attributes({
    customer_age: "new_customer",
});
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

Sometimes it is necessary to ensure all events have been published to the A/B Smartly collector, before proceeding. One such case is when the user is about to navigate away right before being exposed to a treatment. You can explicitly call the `publish()` method, which returns a promise, before navigating away.

```javascript
await context.publish();
window.location = "https://www.absmartly.com";
```

### Finalizing

The `finalize()` method will ensure all events have been published to the A/B Smartly collector, like `publish()`, and will also "seal" the context, throwing an error if any method is called after finalization.

```javascript
await context.finalize();
window.location = "https://www.absmartly.com";
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

### HTTP Request Timeout

It is possible to set a timeout per individual HTTP request, overriding the global timeout set for all requests when instantiating the SDK object.

Here is an example of setting a timeout only for the `createContext` request.

```javascript
const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000,
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
    refreshInterval: 5 * 60 * 1000,
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

## Migration Guide

This version includes minor breaking changes made for cross-SDK consistency and correctness. These align the JavaScript SDK with the Python, Swift, Java, and other A/B Smartly SDKs.

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

### `override()` now throws after finalization

`override()` now calls `_checkNotFinalized()`, consistent with `customAssignment()`, `track()`, and `attribute()`. Previously, overrides could be set on a finalized context silently with no effect.

## About A/B Smartly

**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them. A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk) (this package)
- [React SDK](https://www.github.com/absmartly/react-sdk)
- [Vue2 SDK](https://www.github.com/absmartly/vue2-sdk)
- [Vue3 SDK](https://www.github.com/absmartly/vue3-sdk)
- [Java SDK](https://www.github.com/absmartly/java-sdk)
- [Android SDK](https://www.github.com/absmartly/android-sdk)
- [Swift SDK](https://www.github.com/absmartly/swift-sdk)
- [Dart SDK](https://www.github.com/absmartly/dart-sdk)
- [Flutter SDK](https://www.github.com/absmartly/flutter-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
- [Python3 SDK](https://www.github.com/absmartly/python3-sdk)
- [Go SDK](https://www.github.com/absmartly/go-sdk)
- [Ruby SDK](https://www.github.com/absmartly/ruby-sdk)
- [.NET SDK](https://www.github.com/absmartly/dotnet-sdk)
- [Rust SDK](https://www.github.com/absmartly/rust-sdk)
