# A/B Smartly SDK [![npm version](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk.svg)](https://badge.fury.io/js/%40absmartly%2Fjavascript-sdk)

A/B Smartly - JavaScript SDK

## Compatibility

The Javascript SDK is an isomorphic library for Node.js (CommonJS and ES6) and browsers (UMD).

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
```javascript
// somewhere in your application initialization code
const client = new absmartly.SDK({
    endpoint: 'https://sandbox-api.absmartly.com/v1',
    apiKey: '87e325d7860c75eac6d504416026794afded9fd8',
    application: {
        name: 'website',
        version: 1_000_000,
    },
});
```

#### Creating a new Context
```javascript
// define a new context request
const request = {
    units: {
        session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8',
    },
    attributes: [
        {
            "name": "useragent",
            "value": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
        }
    ],
};


// create context with raw promises
client.createContext(request).then((response) => {
    console.log(response);
}).catch((error) => {
    console.log(error);
});


// or create context with async/await
async function createExperimentContext() {
    try {
        let response = client.createContext(request);
        console.log(response);
    } catch (e) {
        console.log(e);
    }
}
```


## About A/B Smartly
**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them.
A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk)
- [ReactJS SDK](https://www.github.com/absmartly/reactjs-sdk)
- [Vue.js SDK](https://www.github.com/absmartly/vuejs-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
