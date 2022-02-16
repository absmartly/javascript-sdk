// inspired by https://github.com/bradlc/unfetch-abortable
import { AbortError } from "./errors";

// eslint-disable-next-line no-shadow
export function fetch(url, options) {
	options = options || {};
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		const keys = [];
		const all = [];
		const headers = {};

		const abort = () => {
			request.abort();
		};

		const cleanup = options.signal ? () => options.signal.removeEventListener("abort", abort) : () => {};

		const response = () => ({
			ok: ((request.status / 100) | 0) === 2,
			statusText: request.statusText,
			status: request.status,
			url: request.responseURL,
			text: () => Promise.resolve(request.responseText),
			json: () => Promise.resolve(JSON.parse(request.responseText)),
			blob: () => Promise.resolve(new Blob([request.response])),
			clone: response,
			headers: {
				keys: () => keys,
				entries: () => all,
				get: (n) => headers[n.toLowerCase()],
				has: (n) => n.toLowerCase() in headers,
			},
		});

		request.open(options.method || "get", url, true);

		request.onload = () => {
			request.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, (m, key, value) => {
				keys.push((key = key.toLowerCase()));
				all.push([key, value]);
				headers[key] = headers[key] ? `${headers[key]},${value}` : value;
			});

			cleanup();
			resolve(response());
		};

		if (options.signal) {
			options.signal.addEventListener("abort", abort);
		}

		request.onerror = (error) => {
			cleanup();
			reject(error);
		};

		request.onabort = () => {
			cleanup();
			reject(new AbortError("The user aborted a request."));
		};

		request.withCredentials = options.credentials === "include";

		for (const i in options.headers) {
			request.setRequestHeader(i, options.headers[i]);
		}

		request.send(options.body || null);
	});
}

export default fetch;
