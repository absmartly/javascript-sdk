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
    endpoint: 'https://sandbox-api.absmartly.com/v1',
    apiKey: process.env.ABSMARTLY_API_KEY,
    environment: process.env.NODE_ENV,
    application: {
        name: process.env.APPLICATION_NAME,
        version: process.env.APPLICATION_VERSION,
    },
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
const context = client.createContext(request);

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
const context = client.createContext(request);

try {
    await context.ready();
    console.log("ABSmartly Context ready!")
} catch (e) {
    console.log(error);
}
```

#### Setting context attributes
```javascript
context.attribute('user_agent', navigator.userAgent);

context.attributes({
    customer_age: 'new_customer',
});
```

#### Selecting treatment
```javascript
if (context.treament("exp_test_experiment") == 0) {
    // user is in control group (variant 0)
} else {
    // user is in treatment group (variant 1)
}
```

#### Tracking a goal achievement
Goals are created in the A/B Smartly web console.
```javascript
context.goal("payment", 1000);
```

#### Publishing pending data to the A/B Smartly collector
Sometimes it is necessary ensure all events have been published to the A/B Smartly collector, before proceeding.
One such case is when the user is about to navigate away right before being exposed to a treatment.
You can explicitly call the `publish()` method, which returns a promise, before navigating away.
```javascript
await context.publish().then(() => {
    window.location = "https://www.absmartly.com"
})
```

## About A/B Smartly
**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them.
A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
