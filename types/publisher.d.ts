import Context from "./context";
import SDK from "./sdk";
export declare class ContextPublisher {
    publish(request: Record<string, unknown>, sdk: SDK, _: Context, requestOptions?: Record<string, unknown>): any;
}
