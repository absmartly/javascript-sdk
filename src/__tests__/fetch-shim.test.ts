// eslint-disable-next-line no-shadow
import { fetch } from "../fetch-shim";
// eslint-disable-next-line no-shadow
import { AbortController } from "../abort";
import { Response } from "node-fetch";

describe("fetch", () => {
	it("should be a function", () => {
		expect(fetch).toEqual(expect.any(Function));
	});

	describe("fetch()", () => {
		let xhr;

		beforeEach(() => {
			xhr = {
				setRequestHeader: jest.fn(),
				getAllResponseHeaders: jest.fn().mockReturnValue("X-Foo: bar\nX-Foo:baz"),
				open: jest.fn(),
				send: jest.fn(),
				status: 200,
				statusText: "OK",
				responseText: '{"a":"b"}',
				responseURL: "/foo?redirect",
				abort: jest.fn(),
			};

			// @ts-ignore
			global.XMLHttpRequest = jest.fn(() => xhr);
		});

		afterEach(() => {
			delete global.XMLHttpRequest;
		});

		it("sanity test", async (done) => {
			fetch("/foo", { headers: { a: "b" } as any })
				.then((response: Response) => {
					expect(response).toMatchObject({
						text: expect.any(Function),
						json: expect.any(Function),
						blob: expect.any(Function),
						clone: expect.any(Function),
						headers: expect.any(Object),
					});
					expect(response.clone()).not.toBe(response);
					expect(response.clone().url).toEqual("/foo?redirect");
					expect(response.headers.get).toEqual(expect.any(Function));
					expect(response.headers.get("x-foo")).toEqual("bar,baz");
					return response.json();
				})
				.then((data) => {
					expect(data).toEqual({ a: "b" });

					expect(xhr.setRequestHeader).toHaveBeenCalledTimes(1);
					expect(xhr.setRequestHeader).toHaveBeenCalledWith("a", "b");
					expect(xhr.open).toHaveBeenCalledTimes(1);
					expect(xhr.open).toHaveBeenCalledWith("get", "/foo", true);
					expect(xhr.send).toHaveBeenCalledTimes(1);
					expect(xhr.send).toHaveBeenCalledWith(null);

					done();
				});

			expect(xhr.onload).toEqual(expect.any(Function));
			expect(xhr.onerror).toEqual(expect.any(Function));
			expect(xhr.onabort).toEqual(expect.any(Function));

			xhr.onload();
		});

		it("handles empty header values", async (done) => {
			xhr.getAllResponseHeaders = jest.fn().mockReturnValue("Server: \nX-Foo:baz");
			fetch("/foo").then((response: Response) => {
				expect(response.headers.get("server")).toEqual("");
				expect(response.headers.get("X-foo")).toEqual("baz");

				done();
			});

			xhr.onload();
		});

		it("adds and removes the abort event listener", async (done) => {
			const controller = new AbortController();
			jest.spyOn(controller.signal, "addEventListener");
			jest.spyOn(controller.signal, "removeEventListener");

			fetch("/foo", {
				signal: controller.signal,
			})
				.then((response: Response) => {
					return response.json();
				})
				.then((data) => {
					expect(xhr.abort).toHaveBeenCalledTimes(0);
					expect(data).toEqual({ a: "b" });
					expect(controller.signal.addEventListener).toHaveBeenCalledTimes(1);
					expect(controller.signal.removeEventListener).toHaveBeenCalledTimes(1);

					done();
				});

			xhr.onload();
		});

		it("adds and removes the abort event listener on abort", async (done) => {
			const controller = new AbortController();

			jest.spyOn(controller.signal, "addEventListener");
			jest.spyOn(controller.signal, "removeEventListener");

			fetch("/foo", {
				signal: controller.signal,
			}).catch((error) => {
				expect(error.name).toBe("AbortError");
				expect(xhr.abort).toHaveBeenCalledTimes(1);
				expect(controller.signal.addEventListener).toHaveBeenCalledTimes(1);
				expect(controller.signal.removeEventListener).toHaveBeenCalledTimes(1);

				done();
			});

			controller.abort();
			xhr.onabort();
		});

		it("adds and removes the abort event listener on error", async (done) => {
			const controller = new AbortController();

			jest.spyOn(controller.signal, "addEventListener");
			jest.spyOn(controller.signal, "removeEventListener");

			fetch("/foo", {
				signal: controller.signal,
			}).catch(() => {
				expect(xhr.abort).toHaveBeenCalledTimes(0);
				expect(controller.signal.addEventListener).toHaveBeenCalledTimes(1);
				expect(controller.signal.removeEventListener).toHaveBeenCalledTimes(1);

				done();
			});

			xhr.onerror();
		});
	});
});
