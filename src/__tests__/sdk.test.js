import { Client } from "@absmartly/javascript-client";
import SDK from "../sdk";
import Context from "../context";

jest.mock("@absmartly/javascript-client");
jest.mock("../context");

const sdkOptions = {
	endpoint: "localhost:8080",
	agent: "javascript-sdk",
	environment: "test",
	apiKey: "apikey",
	timeout: 1000,
};

describe("SDK", () => {
	it("constructor should create a client with specified options", (done) => {
		const sdk = new SDK(sdkOptions);

		expect(sdk).toBeInstanceOf(SDK);
		expect(Client).toHaveBeenCalledTimes(1);
		expect(Client).toHaveBeenCalledWith(sdkOptions);

		done();
	});

	it("createContext() should create Context object with promise", (done) => {
		const sdk = new SDK(sdkOptions);

		const promise = Promise.resolve({});
		sdk.client.createContext.mockReturnValue(promise);

		const options = {
			publishDelay: -1,
		};

		const request = {
			units: {
				session_id: "ab",
			},
		};

		const context = sdk.createContext(request);

		expect(context).toBeInstanceOf(Context);
		expect(sdk.client.createContext).toHaveBeenCalledTimes(1);
		expect(sdk.client.createContext).toHaveBeenCalledWith({
			units: [{ type: "session_id", uid: "ab" }],
		});

		expect(Context).toHaveBeenCalledTimes(1);
		expect(Context).toHaveBeenCalledWith(sdk, sdk.client, options, promise);

		done();
	});

	it("createContextWith() should not call client createContext", (done) => {
		const data = {
			guid: "test",
		};

		const options = {
			publishDelay: -1,
		};

		const sdk = new SDK(sdkOptions);
		const context = sdk.createContextWith(data);

		expect(context).toBeInstanceOf(Context);
		expect(sdk.client.createContext).not.toHaveBeenCalled();

		expect(Context).toHaveBeenCalledTimes(1);
		expect(Context).toHaveBeenCalledWith(sdk, sdk.client, options, data);

		done();
	});
});
