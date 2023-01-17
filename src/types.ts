import Context from "./context";

export type EventLogger = (context: Context, eventName: string, data?: any) => void;

export type ClientOptions = {
	agent: "javascript-client";
	apiKey: string;
	application: string | { name: string; version: number };
	endpoint: string;
	environment: string;
	retries: number;
	timeout: number;
	keepalive: boolean;
};
