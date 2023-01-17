import Context from "./context";

export type EventLogger = (context: Context, eventName: string, data?: Record<string, unknown>) => void;
