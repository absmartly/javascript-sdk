import Context from "./context";

export type EventLogger = (context: Context, eventName: string, data?: any) => void;
