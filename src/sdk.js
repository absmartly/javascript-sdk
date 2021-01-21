import { Client } from "@absmartly/javascript-client";
import Context from "./context";

export default class SDK {
	constructor(options) {
		options = Object.assign(
			{
				agent: "javascript-sdk",
			},
			options
		);

		this.client = new Client(options);
	}

	createContext(params) {
		const transformed = Object.assign({}, params, {
			units: Object.keys(params.units).map((type) => ({
				type,
				uid: params.units[type],
			})),
		});
		const data = this.client.createContext(transformed);
		return new Context(this, this.client, data);
	}

	createContextWith(data) {
		return new Context(this, this.client, data);
	}
}
