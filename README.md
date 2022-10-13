# A/B Smartly SDK [![npm version](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk.svg)](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk)

A/B Smartly - JavaScript SDK

## Compatibility

The A/B Smartly Javascript SDK is an isomorphic library for Node.js (CommonJS and ES6) and browsers (UMD).

It's supported on Node.js version 6.x and npm 3.x or later.

It's supported on IE 10+ and all the other major browsers.

**Note**: IE 10 does not natively support Promises.
If you target IE 10, you must include a polyfill like [es6-promise](https://www.npmjs.com/package/es6-promise) or [rsvp](https://www.npmjs.com/package/rsvp).

## Installation

#### npm

```shell
npm install @absmartly/javascript-sdk --save
```

#### Import in your Javascript application
```javascript
const absmartly = require('@absmartly/javascript-sdk');
// OR with ES6 modules:
import absmartly from '@absmartly/javascript-sdk';
```


#### Directly in the browser
You can include an optimized and pre-built package directly in your HTML code through [unpkg.com](https://www.unpkg.com).

Simply add the following code to your `head` section to include the latest published version.
```html
    <script src="https://unpkg.com/@absmartly/javascript-sdk/dist/absmartly.min.js"></script>
```

## Getting Started

Please follow the [installation](#installation) instructions before trying the following code:

#### Initialization
This example assumes an Api Key, an Application, and an Environment have been created in the A/B Smartly web console.
```javascript
// somewhere in your application initialization code
const sdk = new absmartly.SDK({
    endpoint: 'https://sandbox.absmartly.io/v1',
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: process.env.APPLICATION_NAME,
});
```

#### Creating a new Context with raw promises
```javascript
// define a new context request
const request = {
    units: {
        session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8',
    },
};

// create context with raw promises
const context = sdk.createContext(request);

context.ready().then((response) => {
    console.log("ABSmartly Context ready!")
}).catch((error) => {
    console.log(error);
});
```

#### Creating a new Context with async/await
```javascript
// define a new context request
const request = {
    units: {
        session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8',
    },
};

// create context with raw promises
const context = sdk.createContext(request);

try {
    await context.ready();
    console.log("ABSmartly Context ready!")
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
            const request = {
                units: {
                    session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8',
                },
            };

            const context = sdk.createContextWith(request, {{ serverSideContext.data() }});
        </script>
    </head>
```

#### Setting extra units for a context
You can add additional units to a context by calling the `unit()` or the `units()` method.
This method may be used for example, when a user logs in to your application, and you want to use the new unit type to the context.
Please note that **you cannot override an already set unit type** as that would be a change of identity, and will throw an exception. In this case, you must create a new context instead.
The `unit()` and `units()` methods can be called before the context is ready.

```javascript
context.unit('db_user_id', 1000013);

// or
context.units({
    db_user_id: 1000013,
});
```

#### Setting context attributes
The `attribute()` and `attributes()` methods can be called before the context is ready.
```javascript
context.attribute('user_agent', navigator.userAgent);

context.attributes({
    customer_age: 'new_customer',
});
```

#### Selecting a treatment
```javascript
if (context.treament("exp_test_experiment") == 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group
}
```

#### Tracking a goal achievement
Goals are created in the A/B Smartly web console.
```javascript
context.track("payment", { item_count: 1, total_amount: 1999.99 });
```

#### Publishing pending data
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
To mitigate this, we can use the `refreshInterval` option when creating the context.

```javascript
const request = {
    units: {
        session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8',
    },
};

const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000
});
```

Alternatively, the `refresh()` method can be called manually.
The `refresh()` method pulls updated experiment data from the A/B Smartly collector and will trigger recently started experiments when `treatment()` is called again.
```javascript
setTimeout(async () => {
    try {
        context.refresh();
    } catch(error) {
        console.error(error);
    }
}, 5 * 60 * 1000);
```

#### Using a custom Event Logger
The A/B Smartly SDK can be instantiated with an event logger used for all contexts.
In addition, an event logger can be specified when creating a particular context, in the `createContext` call options.
The example below illustrates this with the implementation of the default event logger, used if none is specified.
```javascript
const sdk = new absmartly.SDK({
    endpoint: 'https://sandbox-api.absmartly.com/v1',
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: process.env.APPLICATION_NAME,
    eventLogger: (context, eventName, data) => {
        if (eventName == "error") {
            console.error(data);
        }
    },
});
```

The data parameter depends on the type of event.
Currently, the SDK logs the following events:

| eventName | when | data |
|:---: |---|---|
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

```javascript
if (context.peek("exp_test_experiment") == 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group
}
```

#### Overriding treatment variants
During development, for example, it is useful to force a treatment for an experiment. This can be achieved with the `override()` and/or `overrides()` methods.
The `override()` and `overrides()` methods can be called before the context is ready.
```javascript
    context.override("exp_test_experiment", 1); // force variant 1 of treatment
    context.overrides({
        exp_test_experiment: 1,
        exp_another_experiment: 0,
    });
```

#### HTTP request timeout
It is possible to set a timeout per individual HTTP request, overriding the global timeout set for all request when instantiating the SDK object.

Here is an example of setting a timeout only for the createContext request.

```javascript
const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000
}, {
    timeout: 1500
});
```

#### HTTP Request cancellation
Sometimes it is useful to cancel an inflight HTTP request, for example, when the user is navigating away. The A/B Smartly SDK also supports a cancellation via an `AbortSignal`. An implementation of AbortController is provided for older platforms, but will use the native implementation where available.

Here is an example of a cancellation scenario.

```javascript
const controller = new absmartly.AbortController();
const context = sdk.createContext(request, {
    refreshInterval: 5 * 60 * 1000
}, {
    signal: controller.signal
});

// abort request if not ready after 1500ms
const timeoutId = setTimeout(() => controller.abort(), 1500);

await context.ready();

clearTimeout(timeoutId);
```


## About A/B Smartly
**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them.
A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [Java SDK](https://www.github.com/absmartly/java-sdk)
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
- [Swift SDK](https://www.github.com/absmartly/swift-sdk)
- [Vue2 SDK](https://www.github.com/absmartly/vue2-sdk)
