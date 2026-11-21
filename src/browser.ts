// rfdc uses Map and Set during module initialization; include their IE10 polyfills before config imports it.
import "core-js/es/map";
import "core-js/es/set";
import Context from "./context";
import SDK from "./sdk";
import { mergeConfig } from "./config";
import { ContextDataProvider } from "./provider";
import { ContextPublisher } from "./publisher";
// eslint-disable-next-line no-shadow
import { AbortController } from "./abort";

export default { mergeConfig, AbortController, Context, ContextDataProvider, ContextPublisher, SDK, ABsmartly: SDK };
