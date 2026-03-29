# ABSmartly JavaScript SDK - TypeScript Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the ABSmartly JavaScript SDK from scratch in strict TypeScript, modernizing the build system and dropping legacy polyfills while maintaining identical public API and hashing behavior.

**Architecture:** Clean TypeScript with strict types throughout. All shared types in a central `types.ts` file. Hashing algorithms (murmur3, md5) ported verbatim to ensure byte-level compatibility. JsonExpr engine uses a clean operator interface. Client uses native `fetch` with retry/backoff. Build outputs ESM, CJS, and browser UMD via tsup.

**Tech Stack:** TypeScript 5.x, Vitest, tsup (esbuild-based bundler), native fetch/AbortController (Node 18+, modern browsers)

---

## Scope & Key Decisions

**Dropping legacy support:**
- Node.js 6+ / IE 10+ -> Node.js 18+ / modern browsers (last 2 versions)
- Remove `core-js` polyfills
- Remove `node-fetch` dependency (native fetch in Node 18+)
- Remove `fetch-shim.ts` (XMLHttpRequest-based fetch polyfill)
- Remove `abort-controller-shim.ts` (native AbortController everywhere)
- Remove `abort.ts` and `fetch.ts` platform-detection wrappers
- Remove `rfdc` dependency (use `structuredClone`)
- Remove `browser.ts` (UMD entry point handled by bundler)

**Dropping Babel entirely:**
- No more babel.config.js, no @babel/* devDependencies
- TypeScript compiler for type checking, tsup for bundling (ESM + CJS + browser)

**Keeping identical:**
- Public API surface: `SDK`, `Context`, `ContextDataProvider`, `ContextPublisher`, `mergeConfig`
- Hashing algorithms: murmur3_32, md5 (byte-level identical output)
- JsonExpr evaluation engine and all 20 operators
- Variant assignment algorithm
- Client retry/backoff logic
- Context lifecycle (ready, publish, refresh, finalize)

**Test framework:**
- Vitest instead of Jest (faster, native TypeScript, ESM-first)
- Same test coverage, modernized with async/await

---

## File Structure

```
src/
  types.ts                      # All shared type definitions
  errors.ts                     # Custom error classes (TimeoutError, RetryError, AbortError)
  algorithm.ts                  # insertUniqueSorted utility
  murmur3.ts                    # Murmur3 32-bit hash
  md5.ts                        # MD5 hash
  hashing.ts                    # hashUnit, base64UrlNoPadding, stringToUint8Array
  utils.ts                      # isObject, isPromise, isEqualsDeep, arrayEqualsShallow, chooseVariant
  assigner.ts                   # VariantAssigner
  jsonexpr/
    evaluator.ts                # Expression evaluation engine with type conversion
    operators.ts                # All 20 operators in one file (they are small)
    jsonexpr.ts                 # JsonExpr class wiring operators to evaluator
  matcher.ts                    # AudienceMatcher
  client.ts                     # HTTP client with retry logic
  provider.ts                   # ContextDataProvider
  publisher.ts                  # ContextPublisher
  context.ts                    # Context class
  sdk.ts                        # SDK class
  config.ts                     # mergeConfig utility
  index.ts                      # Public API exports
  version.ts                    # Generated SDK version

src/__tests__/
  errors.test.ts
  algorithm.test.ts
  murmur3.test.ts
  md5.test.ts
  hashing.test.ts
  utils.test.ts
  assigner.test.ts
  jsonexpr/
    evaluator.test.ts
    operators.test.ts
    jsonexpr.test.ts
  matcher.test.ts
  client.test.ts
  provider.test.ts
  publisher.test.ts
  context.test.ts
  sdk.test.ts
  config.test.ts

tsconfig.json
tsup.config.ts
vitest.config.ts
package.json
scripts/
  generate-version.ts
```

**Key structural changes from original:**
- `types.ts`: Centralized types instead of scattered across files
- `hashing.ts`: Extracted from `utils.ts` — hashing/encoding utilities are a distinct concern
- `jsonexpr/operators.ts`: All 20 operators consolidated into one file (each is 5-15 lines)
- Removed: `fetch.ts`, `fetch-shim.ts`, `abort.ts`, `abort-controller-shim.ts`, `browser.ts`

---

## Task 1: Project Scaffolding & Build System

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `scripts/generate-version.ts`
- Create: `src/version.ts`
- Create: `.gitignore`

- [ ] **Step 1: Delete all existing source files**

Remove the old codebase to start fresh:

```bash
rm -rf src/ js/ lib/ es/ dist/ types/ scripts/
rm -f babel.config.js webpack.config.js jest.config.js .eslintrc.js .prettierrc.json .browserslistrc .editorconfig
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "@absmartly/javascript-sdk",
  "version": "2.0.0",
  "description": "A/B Smartly Javascript SDK",
  "homepage": "https://github.com/absmartly/javascript-sdk#README.md",
  "bugs": "https://github.com/absmartly/javascript-sdk/issues",
  "keywords": [
    "absmartly",
    "ab-smartly",
    "a/b-smartly",
    "ab-testing",
    "a/b-testing",
    "split-testing",
    "ab",
    "a/b",
    "cro"
  ],
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "browser": "dist/index.global.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "npm run generate-version && tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "generate-version": "tsx scripts/generate-version.ts",
    "prepack": "npm run build"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^3.0.0",
    "tsx": "^4.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "README.md",
    "LICENSE",
    "package.json",
    "dist/"
  ]
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "node_modules"]
}
```

- [ ] **Step 4: Write tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "absmartly",
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  target: "es2022",
  outExtension({ format }) {
    if (format === "iife") return { js: ".global.js" };
    return {};
  },
});
```

- [ ] **Step 5: Write vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/version.ts"],
    },
  },
});
```

- [ ] **Step 6: Write scripts/generate-version.ts**

```typescript
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
writeFileSync("src/version.ts", `export const SDK_VERSION = "${pkg.version}";\n`);
```

- [ ] **Step 7: Write src/version.ts**

```typescript
export const SDK_VERSION = "2.0.0";
```

- [ ] **Step 8: Write .gitignore**

```
node_modules/
dist/
coverage/
*.tsbuildinfo
```

- [ ] **Step 9: Install dependencies**

```bash
npm ci
```

- [ ] **Step 10: Verify build system works**

Create a minimal `src/index.ts`:

```typescript
export const placeholder = true;
```

Run:

```bash
npx tsc --noEmit && npx tsup
```

Expected: Build succeeds, `dist/` contains `index.js`, `index.cjs`, `index.global.js`, `index.d.ts`

- [ ] **Step 11: Verify test system works**

Create `src/__tests__/placeholder.test.ts`:

```typescript
import { expect, test } from "vitest";

test("placeholder", () => {
  expect(true).toBe(true);
});
```

Run: `npx vitest run`

Expected: 1 test passes

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold TypeScript project with tsup, vitest, and modern config"
```

---

## Task 2: Types & Errors

**Files:**
- Create: `src/types.ts`
- Create: `src/errors.ts`
- Create: `src/__tests__/errors.test.ts`

- [ ] **Step 1: Write the failing tests for errors**

```typescript
import { describe, expect, test } from "vitest";
import { AbortError, RetryError, TimeoutError } from "../errors";

describe("TimeoutError", () => {
  test("has correct name, message, and timeout", () => {
    const error = new TimeoutError(3000);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("Timeout exceeded.");
    expect(error.timeout).toBe(3000);
  });
});

describe("RetryError", () => {
  test("has correct name, message, retries, and exception", () => {
    const cause = new Error("connection refused");
    const error = new RetryError(5, cause, "https://example.com/api");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RetryError);
    expect(error.name).toBe("RetryError");
    expect(error.message).toBe("Retries exhausted. URL: https://example.com/api - Last Error: connection refused");
    expect(error.retries).toBe(5);
    expect(error.exception).toBe(cause);
  });
});

describe("AbortError", () => {
  test("has correct name and default message", () => {
    const error = new AbortError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AbortError);
    expect(error.name).toBe("AbortError");
  });

  test("accepts custom message", () => {
    const error = new AbortError("user cancelled");
    expect(error.message).toBe("user cancelled");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/errors.test.ts`

Expected: FAIL - modules not found

- [ ] **Step 3: Write src/types.ts**

```typescript
export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type CustomFieldValueType = "text" | "string" | "number" | "json" | "boolean";

export type CustomFieldValue = {
  name: string;
  value: string;
  type: CustomFieldValueType;
};

export type ExperimentData = {
  id: number;
  name: string;
  unitType: string | null;
  iteration: number;
  fullOnVariant: number;
  trafficSplit: number[];
  trafficSeedHi: number;
  trafficSeedLo: number;
  audience: string;
  audienceStrict: boolean;
  split: number[];
  seedHi: number;
  seedLo: number;
  variants: { config: null | string }[];
  variables: Record<string, unknown>;
  variant: number;
  overridden: boolean;
  assigned: boolean;
  exposed: boolean;
  eligible: boolean;
  fullOn: boolean;
  custom: boolean;
  audienceMismatch: boolean;
  customFieldValues: CustomFieldValue[] | null;
};

export type Assignment = {
  id: number;
  iteration: number;
  fullOnVariant: number;
  unitType: string | null;
  variant: number;
  overridden: boolean;
  assigned: boolean;
  exposed: boolean;
  eligible: boolean;
  fullOn: boolean;
  custom: boolean;
  audienceMismatch: boolean;
  trafficSplit?: number[];
  variables?: Record<string, unknown>;
  attrsSeq?: number;
};

export type Experiment = {
  data: ExperimentData;
  variables: Record<string, unknown>[];
};

export type Unit = {
  type: string;
  uid: string | null;
};

export type Exposure = {
  id: number;
  name: string;
  exposedAt: number;
  unit: string | null;
  variant: number;
  assigned: boolean;
  eligible: boolean;
  overridden: boolean;
  fullOn: boolean;
  custom: boolean;
  audienceMismatch: boolean;
};

export type Attribute = {
  name: string;
  value: unknown;
  setAt: number;
};

export type Units = Record<string, string | number>;

export type Goal = {
  name: string;
  properties: Record<string, unknown> | null;
  achievedAt: number;
};

export type ContextParams = {
  units: Record<string, string | number>;
};

export type ContextData = {
  experiments?: ExperimentData[];
};

export type FetchResponse = {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  statusText: string;
  json: () => Promise<unknown>;
};

export type ApplicationObject = { name: string; version: number | string };

export type ClientRequestOptions = {
  query?: Record<string, string | number | boolean>;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  body?: Record<string, unknown>;
  auth?: boolean;
  signal?: AbortSignal;
  timeout?: number;
};

export type ClientOptions = {
  agent?: string;
  apiKey: string;
  application: string | ApplicationObject;
  endpoint: string;
  environment: string;
  retries?: number;
  timeout?: number;
  keepalive?: boolean;
};

export type NormalizedClientOptions = Omit<Required<ClientOptions>, "application"> & {
  application: ApplicationObject;
};

export type PublishParams = {
  units: Unit[];
  publishedAt: number;
  hashed: boolean;
  sdkVersion: string;
  attributes?: Attribute[];
  goals?: Goal[];
  exposures?: Exposure[];
};

export type EventName = "error" | "ready" | "refresh" | "publish" | "exposure" | "goal" | "finalize";

export type EventLoggerData = Error | Exposure | Goal | ContextData | PublishParams;

export type EventLogger = (context: unknown, eventName: EventName, data?: EventLoggerData) => void;

export type ContextOptions = {
  publisher?: { publish: (request: PublishParams, sdk: unknown, context: unknown, requestOptions?: ClientRequestOptions) => Promise<unknown> };
  dataProvider?: { getContextData: (sdk: unknown, requestOptions?: Partial<ClientRequestOptions>) => Promise<ContextData> };
  eventLogger?: EventLogger;
  refreshPeriod: number;
  publishDelay: number;
  includeSystemAttributes?: boolean;
};

export type SDKOptions = {
  client?: unknown;
  eventLogger?: EventLogger;
  publisher?: unknown;
  provider?: unknown;
};
```

- [ ] **Step 4: Write src/errors.ts**

```typescript
export class TimeoutError extends Error {
  readonly timeout: number;
  constructor(timeout: number) {
    super("Timeout exceeded.");
    this.name = "TimeoutError";
    this.timeout = timeout;
  }
}

export class RetryError extends Error {
  readonly retries: number;
  readonly exception: Error;
  constructor(retries: number, reason: Error, url: string) {
    super(`Retries exhausted. URL: ${url} - Last Error: ${reason.message}`);
    this.name = "RetryError";
    this.retries = retries;
    this.exception = reason;
  }
}

export class AbortError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "AbortError";
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/errors.test.ts`

Expected: 3 tests pass

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/errors.ts src/__tests__/errors.test.ts
git commit -m "feat: add shared type definitions and custom error classes"
```

---

## Task 3: Murmur3 Hash

**Files:**
- Create: `src/murmur3.ts`
- Create: `src/__tests__/murmur3.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "vitest";
import { murmur3_32 } from "../murmur3";

function stringToBuffer(value: string): ArrayBuffer {
  const n = value.length;
  const array: number[] = [];
  let k = 0;
  for (let i = 0; i < n; ++i) {
    const c = value.charCodeAt(i);
    if (c < 0x80) {
      array[k++] = c;
    } else if (c < 0x800) {
      array[k++] = (c >> 6) | 192;
      array[k++] = (c & 63) | 128;
    } else {
      array[k++] = (c >> 12) | 224;
      array[k++] = ((c >> 6) & 63) | 128;
      array[k++] = (c & 63) | 128;
    }
  }
  return Uint8Array.from(array).buffer;
}

describe("murmur3_32", () => {
  const testCases: [string, number, number][] = [
    ["", 0x00000000, 0x00000000],
    [" ", 0x00000000, 0x7ef49b98],
    ["t", 0x00000000, 0xca87df4d],
    ["te", 0x00000000, 0xedb8ee1b],
    ["tes", 0x00000000, 0x0bb90e5a],
    ["test", 0x00000000, 0xba6bd213],
    ["testy", 0x00000000, 0x44af8342],
    ["testy1", 0x00000000, 0x8a1a243a],
    ["testy12", 0x00000000, 0x845461b9],
    ["testy123", 0x00000000, 0xee0abfbc],
    ["special-characters-testing-!@#$%^&*()_+-=[]{}|;':\",./<>?", 0x00000000, 0xe1b16274],
    ["", 0x00000001, 0x514e28b7],
    [" ", 0x00000001, 0x4f0f7132],
    ["t", 0x00000001, 0x5db1831e],
    ["te", 0x00000001, 0xd248bb2e],
    ["tes", 0x00000001, 0xd432eb74],
    ["test", 0x00000001, 0x99c02ae2],
    ["testy", 0x00000001, 0xc5b2dc1e],
    ["testy1", 0x00000001, 0x33925ceb],
    ["testy12", 0x00000001, 0xd92c9f23],
    ["testy123", 0x00000001, 0x3bc1712d],
    ["special-characters-testing-!@#$%^&*()_+-=[]{}|;':\",./<>?", 0x00000001, 0x6d1d2105],
  ];

  for (const [input, seed, expected] of testCases) {
    test(`murmur3_32("${input}", ${seed}) == 0x${expected.toString(16).padStart(8, "0")}`, () => {
      expect(murmur3_32(stringToBuffer(input), seed)).toBe(expected);
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/murmur3.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/murmur3.ts**

```typescript
const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;
const C3 = 0xe6546b64;

const imul32 = Math.imul;

function fmix32(h: number): number {
  h ^= h >>> 16;
  h = imul32(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = imul32(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function rotl32(a: number, b: number): number {
  return (a << b) | (a >>> (32 - b));
}

function scramble32(block: number): number {
  return imul32(rotl32(imul32(block, C1), 15), C2);
}

export function murmur3_32(key: ArrayBufferLike, hash?: number): number {
  hash = (hash || 0) >>> 0;
  const dataView = new DataView(key);

  let i: number;
  const n = dataView.byteLength & ~3;
  for (i = 0; i < n; i += 4) {
    const chunk = dataView.getUint32(i, true);
    hash ^= scramble32(chunk);
    hash = rotl32(hash, 13);
    hash = imul32(hash, 5) + C3;
  }

  let remaining = 0;
  switch (dataView.byteLength & 3) {
    case 3:
      remaining ^= dataView.getUint8(i + 2) << 16;
    // fallthrough
    case 2:
      remaining ^= dataView.getUint8(i + 1) << 8;
    // fallthrough
    case 1:
      remaining ^= dataView.getUint8(i);
      hash ^= scramble32(remaining);
    // fallthrough
    default:
      break;
  }

  hash ^= dataView.byteLength;
  hash = fmix32(hash);
  return hash >>> 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/murmur3.test.ts`

Expected: All 22 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/murmur3.ts src/__tests__/murmur3.test.ts
git commit -m "feat: add murmur3_32 hash implementation"
```

---

## Task 4: MD5 Hash

**Files:**
- Create: `src/md5.ts`
- Create: `src/__tests__/md5.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "vitest";
import { md5 } from "../md5";

function stringToBuffer(value: string): ArrayBuffer {
  const n = value.length;
  const array: number[] = [];
  let k = 0;
  for (let i = 0; i < n; ++i) {
    const c = value.charCodeAt(i);
    if (c < 0x80) {
      array[k++] = c;
    } else if (c < 0x800) {
      array[k++] = (c >> 6) | 192;
      array[k++] = (c & 63) | 128;
    } else {
      array[k++] = (c >> 12) | 224;
      array[k++] = ((c >> 6) & 63) | 128;
      array[k++] = (c & 63) | 128;
    }
  }
  return Uint8Array.from(array).buffer;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("md5", () => {
  const testCases: [string, string][] = [
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["a", "0cc175b9c0f1b6a831c399e269772661"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
    ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
  ];

  for (const [input, expectedHex] of testCases) {
    test(`md5("${input}") == ${expectedHex}`, () => {
      const result = md5(stringToBuffer(input));
      expect(toHex(result)).toBe(expectedHex);
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/md5.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/md5.ts**

```typescript
function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = a + q + (x >>> 0) + t;
  return ((a << s) | (a >>> (32 - s))) + b;
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function md5cycle(x: Uint32Array, k: Uint32Array): void {
  let a = x[0]!;
  let b = x[1]!;
  let c = x[2]!;
  let d = x[3]!;

  a = ff(a, b, c, d, k[0]!, 7, -680876936);
  d = ff(d, a, b, c, k[1]!, 12, -389564586);
  c = ff(c, d, a, b, k[2]!, 17, 606105819);
  b = ff(b, c, d, a, k[3]!, 22, -1044525330);
  a = ff(a, b, c, d, k[4]!, 7, -176418897);
  d = ff(d, a, b, c, k[5]!, 12, 1200080426);
  c = ff(c, d, a, b, k[6]!, 17, -1473231341);
  b = ff(b, c, d, a, k[7]!, 22, -45705983);
  a = ff(a, b, c, d, k[8]!, 7, 1770035416);
  d = ff(d, a, b, c, k[9]!, 12, -1958414417);
  c = ff(c, d, a, b, k[10]!, 17, -42063);
  b = ff(b, c, d, a, k[11]!, 22, -1990404162);
  a = ff(a, b, c, d, k[12]!, 7, 1804603682);
  d = ff(d, a, b, c, k[13]!, 12, -40341101);
  c = ff(c, d, a, b, k[14]!, 17, -1502002290);
  b = ff(b, c, d, a, k[15]!, 22, 1236535329);

  a = gg(a, b, c, d, k[1]!, 5, -165796510);
  d = gg(d, a, b, c, k[6]!, 9, -1069501632);
  c = gg(c, d, a, b, k[11]!, 14, 643717713);
  b = gg(b, c, d, a, k[0]!, 20, -373897302);
  a = gg(a, b, c, d, k[5]!, 5, -701558691);
  d = gg(d, a, b, c, k[10]!, 9, 38016083);
  c = gg(c, d, a, b, k[15]!, 14, -660478335);
  b = gg(b, c, d, a, k[4]!, 20, -405537848);
  a = gg(a, b, c, d, k[9]!, 5, 568446438);
  d = gg(d, a, b, c, k[14]!, 9, -1019803690);
  c = gg(c, d, a, b, k[3]!, 14, -187363961);
  b = gg(b, c, d, a, k[8]!, 20, 1163531501);
  a = gg(a, b, c, d, k[13]!, 5, -1444681467);
  d = gg(d, a, b, c, k[2]!, 9, -51403784);
  c = gg(c, d, a, b, k[7]!, 14, 1735328473);
  b = gg(b, c, d, a, k[12]!, 20, -1926607734);

  a = hh(a, b, c, d, k[5]!, 4, -378558);
  d = hh(d, a, b, c, k[8]!, 11, -2022574463);
  c = hh(c, d, a, b, k[11]!, 16, 1839030562);
  b = hh(b, c, d, a, k[14]!, 23, -35309556);
  a = hh(a, b, c, d, k[1]!, 4, -1530992060);
  d = hh(d, a, b, c, k[4]!, 11, 1272893353);
  c = hh(c, d, a, b, k[7]!, 16, -155497632);
  b = hh(b, c, d, a, k[10]!, 23, -1094730640);
  a = hh(a, b, c, d, k[13]!, 4, 681279174);
  d = hh(d, a, b, c, k[0]!, 11, -358537222);
  c = hh(c, d, a, b, k[3]!, 16, -722521979);
  b = hh(b, c, d, a, k[6]!, 23, 76029189);
  a = hh(a, b, c, d, k[9]!, 4, -640364487);
  d = hh(d, a, b, c, k[12]!, 11, -421815835);
  c = hh(c, d, a, b, k[15]!, 16, 530742520);
  b = hh(b, c, d, a, k[2]!, 23, -995338651);

  a = ii(a, b, c, d, k[0]!, 6, -198630844);
  d = ii(d, a, b, c, k[7]!, 10, 1126891415);
  c = ii(c, d, a, b, k[14]!, 15, -1416354905);
  b = ii(b, c, d, a, k[5]!, 21, -57434055);
  a = ii(a, b, c, d, k[12]!, 6, 1700485571);
  d = ii(d, a, b, c, k[3]!, 10, -1894986606);
  c = ii(c, d, a, b, k[10]!, 15, -1051523);
  b = ii(b, c, d, a, k[1]!, 21, -2054922799);
  a = ii(a, b, c, d, k[8]!, 6, 1873313359);
  d = ii(d, a, b, c, k[15]!, 10, -30611744);
  c = ii(c, d, a, b, k[6]!, 15, -1560198380);
  b = ii(b, c, d, a, k[13]!, 21, 1309151649);
  a = ii(a, b, c, d, k[4]!, 6, -145523070);
  d = ii(d, a, b, c, k[11]!, 10, -1120210379);
  c = ii(c, d, a, b, k[2]!, 15, 718787259);
  b = ii(b, c, d, a, k[9]!, 21, -343485551);

  x[0] = (a + x[0]!) >>> 0;
  x[1] = (b + x[1]!) >>> 0;
  x[2] = (c + x[2]!) >>> 0;
  x[3] = (d + x[3]!) >>> 0;
}

export function md5(key: ArrayBufferLike): Uint8Array {
  const dataView = new DataView(key);

  let i: number;
  const l = dataView.byteLength;
  const n = l & ~63;
  const block = new Uint32Array(16);
  const state = Uint32Array.of(1732584193, -271733879, -1732584194, 271733878);
  for (i = 0; i < n; i += 64) {
    for (let w = 0; w < 16; ++w) {
      block[w] = dataView.getUint32(i + (w << 2), true);
    }
    md5cycle(state, block);
  }

  let w = 0;
  const m = l & ~3;
  for (; i < m; i += 4) {
    block[w++] = dataView.getUint32(i, true);
  }

  const p = l & 3;
  switch (p) {
    case 3:
      block[w++] =
        0x80000000 | dataView.getUint8(i) | (dataView.getUint8(i + 1) << 8) | (dataView.getUint8(i + 2) << 16);
      break;
    case 2:
      block[w++] = 0x800000 | dataView.getUint8(i) | (dataView.getUint8(i + 1) << 8);
      break;
    case 1:
      block[w++] = 0x8000 | dataView.getUint8(i);
      break;
    default:
      block[w++] = 0x80;
      break;
  }

  if (w > 14) {
    for (; w < 16; ++w) {
      block[w] = 0;
    }
    md5cycle(state, block);
    w = 0;
  }

  for (; w < 16; ++w) {
    block[w] = 0;
  }

  block[14] = l << 3;
  md5cycle(state, block);
  return new Uint8Array(state.buffer);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/md5.test.ts`

Expected: All 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/md5.ts src/__tests__/md5.test.ts
git commit -m "feat: add MD5 hash implementation"
```

---

## Task 5: Hashing Utilities

**Files:**
- Create: `src/hashing.ts`
- Create: `src/__tests__/hashing.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "vitest";
import { base64UrlNoPadding, hashUnit, stringToUint8Array } from "../hashing";

describe("stringToUint8Array", () => {
  test("encodes ASCII", () => {
    const result = stringToUint8Array("abc");
    expect(Array.from(result)).toEqual([97, 98, 99]);
  });

  test("encodes multi-byte characters", () => {
    const result = stringToUint8Array("\u00e9");
    expect(Array.from(result)).toEqual([0xc3, 0xa9]);
  });

  test("encodes empty string", () => {
    const result = stringToUint8Array("");
    expect(result.length).toBe(0);
  });
});

describe("base64UrlNoPadding", () => {
  test("encodes empty", () => {
    expect(base64UrlNoPadding(new Uint8Array([]))).toBe("");
  });

  test("encodes 1 byte", () => {
    expect(base64UrlNoPadding(new Uint8Array([0]))).toBe("AA");
  });

  test("encodes 2 bytes", () => {
    expect(base64UrlNoPadding(new Uint8Array([0, 0]))).toBe("AAA");
  });

  test("encodes 3 bytes", () => {
    expect(base64UrlNoPadding(new Uint8Array([0, 0, 0]))).toBe("AAAA");
  });
});

describe("hashUnit", () => {
  test("hashes string unit", () => {
    const result = hashUnit("test_unit");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("hashes numeric unit", () => {
    const result = hashUnit(12345);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("produces consistent results", () => {
    expect(hashUnit("abc")).toBe(hashUnit("abc"));
    expect(hashUnit(123)).toBe(hashUnit(123));
  });

  test("produces different results for different inputs", () => {
    expect(hashUnit("abc")).not.toBe(hashUnit("def"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/hashing.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/hashing.ts**

```typescript
import { md5 } from "./md5";

export function stringToUint8Array(value: string): Uint8Array {
  const n = value.length;
  const array: number[] = [];
  let k = 0;
  for (let i = 0; i < n; ++i) {
    const c = value.charCodeAt(i);
    if (c < 0x80) {
      array[k++] = c;
    } else if (c < 0x800) {
      array[k++] = (c >> 6) | 192;
      array[k++] = (c & 63) | 128;
    } else {
      array[k++] = (c >> 12) | 224;
      array[k++] = ((c >> 6) & 63) | 128;
      array[k++] = (c & 63) | 128;
    }
  }
  return Uint8Array.from(array);
}

const BASE64_URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function base64UrlNoPadding(value: Uint8Array): string {
  const chars = BASE64_URL_CHARS;
  const remaining = value.byteLength % 3;
  const encodeLen = ((value.byteLength / 3) | 0) * 4 + (remaining === 0 ? 0 : remaining === 1 ? 2 : 3);
  const result = new Array<string>(encodeLen);

  let i: number;
  let out = 0;
  const len = value.byteLength - remaining;
  for (i = 0; i < len; i += 3) {
    const bytes = (value[i]! << 16) | (value[i + 1]! << 8) | value[i + 2]!;
    result[out] = chars[(bytes >> 18) & 63]!;
    result[out + 1] = chars[(bytes >> 12) & 63]!;
    result[out + 2] = chars[(bytes >> 6) & 63]!;
    result[out + 3] = chars[bytes & 63]!;
    out += 4;
  }

  switch (remaining) {
    case 2: {
      const bytes = (value[i]! << 16) | (value[i + 1]! << 8);
      result[out] = chars[(bytes >> 18) & 63]!;
      result[out + 1] = chars[(bytes >> 12) & 63]!;
      result[out + 2] = chars[(bytes >> 6) & 63]!;
      break;
    }
    case 1: {
      const bytes = value[i]! << 16;
      result[out] = chars[(bytes >> 18) & 63]!;
      result[out + 1] = chars[(bytes >> 12) & 63]!;
      break;
    }
    default:
      break;
  }

  return result.join("");
}

export function hashUnit(value: string | number): string {
  const unit = typeof value === "string" ? value : value.toFixed(0);
  return base64UrlNoPadding(md5(stringToUint8Array(unit).buffer));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/hashing.test.ts`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/hashing.ts src/__tests__/hashing.test.ts
git commit -m "feat: add hashing utilities (stringToUint8Array, base64UrlNoPadding, hashUnit)"
```

---

## Task 6: Core Utilities

**Files:**
- Create: `src/utils.ts`
- Create: `src/algorithm.ts`
- Create: `src/__tests__/utils.test.ts`
- Create: `src/__tests__/algorithm.test.ts`

- [ ] **Step 1: Write the failing tests for utils**

```typescript
import { describe, expect, test } from "vitest";
import { arrayEqualsShallow, chooseVariant, isEqualsDeep, isObject, isPromise } from "../utils";

describe("isObject", () => {
  test("returns true for plain objects", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  test("returns false for non-objects", () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject("str")).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject(new Date())).toBe(false);
  });
});

describe("isPromise", () => {
  test("returns true for promises", () => {
    expect(isPromise(Promise.resolve())).toBe(true);
    expect(isPromise({ then: () => {} })).toBe(true);
  });

  test("returns false for non-promises", () => {
    expect(isPromise(null)).toBe(false);
    expect(isPromise(undefined)).toBe(false);
    expect(isPromise({})).toBe(false);
    expect(isPromise(42)).toBe(false);
  });
});

describe("isEqualsDeep", () => {
  test("primitives", () => {
    expect(isEqualsDeep(1, 1)).toBe(true);
    expect(isEqualsDeep(1, 2)).toBe(false);
    expect(isEqualsDeep("a", "a")).toBe(true);
    expect(isEqualsDeep("a", "b")).toBe(false);
    expect(isEqualsDeep(true, true)).toBe(true);
    expect(isEqualsDeep(true, false)).toBe(false);
  });

  test("NaN", () => {
    expect(isEqualsDeep(NaN, NaN)).toBe(true);
  });

  test("arrays", () => {
    expect(isEqualsDeep([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isEqualsDeep([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(isEqualsDeep([1, 2], [1, 2, 3])).toBe(false);
  });

  test("objects", () => {
    expect(isEqualsDeep({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(isEqualsDeep({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqualsDeep({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  test("nested structures", () => {
    expect(isEqualsDeep({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(isEqualsDeep({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  test("different types", () => {
    expect(isEqualsDeep(1, "1")).toBe(false);
    expect(isEqualsDeep([], {})).toBe(false);
  });
});

describe("arrayEqualsShallow", () => {
  test("same reference", () => {
    const arr = [1, 2, 3];
    expect(arrayEqualsShallow(arr, arr)).toBe(true);
  });

  test("equal arrays", () => {
    expect(arrayEqualsShallow([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  test("different arrays", () => {
    expect(arrayEqualsShallow([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  test("different lengths", () => {
    expect(arrayEqualsShallow([1, 2], [1, 2, 3])).toBe(false);
  });

  test("both undefined", () => {
    expect(arrayEqualsShallow(undefined, undefined)).toBe(true);
  });
});

describe("chooseVariant", () => {
  test("selects correct variant based on probability", () => {
    expect(chooseVariant([0.5, 0.5], 0.0)).toBe(0);
    expect(chooseVariant([0.5, 0.5], 0.4)).toBe(0);
    expect(chooseVariant([0.5, 0.5], 0.5)).toBe(1);
    expect(chooseVariant([0.5, 0.5], 0.9)).toBe(1);
  });

  test("three-way split", () => {
    expect(chooseVariant([0.33, 0.33, 0.34], 0.0)).toBe(0);
    expect(chooseVariant([0.33, 0.33, 0.34], 0.3)).toBe(0);
    expect(chooseVariant([0.33, 0.33, 0.34], 0.33)).toBe(1);
    expect(chooseVariant([0.33, 0.33, 0.34], 0.65)).toBe(1);
    expect(chooseVariant([0.33, 0.33, 0.34], 0.66)).toBe(2);
  });

  test("returns last variant for probability >= 1", () => {
    expect(chooseVariant([0.5, 0.5], 1.0)).toBe(1);
  });
});
```

- [ ] **Step 2: Write the failing tests for algorithm**

```typescript
import { describe, expect, test } from "vitest";
import { insertUniqueSorted } from "../algorithm";

describe("insertUniqueSorted", () => {
  test("inserts into empty array", () => {
    const arr: number[] = [];
    insertUniqueSorted(arr, 5, (a, b) => a < b);
    expect(arr).toEqual([5]);
  });

  test("inserts in sorted order", () => {
    const arr = [1, 3, 5];
    insertUniqueSorted(arr, 2, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 5]);
  });

  test("inserts at beginning", () => {
    const arr = [2, 3, 4];
    insertUniqueSorted(arr, 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 4]);
  });

  test("inserts at end", () => {
    const arr = [1, 2, 3];
    insertUniqueSorted(arr, 4, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 4]);
  });

  test("does not insert duplicate", () => {
    const arr = [1, 2, 3];
    insertUniqueSorted(arr, 2, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/utils.test.ts src/__tests__/algorithm.test.ts`

Expected: FAIL - modules not found

- [ ] **Step 4: Write src/utils.ts**

```typescript
export function isObject(value: unknown): value is Record<string, unknown> {
  if (!(value instanceof Object)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto == null || proto === Object.prototype;
}

export function isPromise(value: unknown): value is Promise<unknown> {
  return value !== null && typeof value === "object" && typeof (value as Promise<unknown>).then === "function";
}

function arrayEqualsDeep(a: unknown[], b: unknown[], astack: unknown[] = [], bstack: unknown[] = []): boolean {
  let len = astack.length;
  while (len--) {
    if (astack[len] === a) return bstack[len] === b;
  }

  astack.push(a);
  bstack.push(b);

  len = a.length;
  while (len--) {
    if (!isEqualsDeep(a[len], b[len], astack, bstack)) return false;
  }

  bstack.pop();
  astack.pop();

  return true;
}

function objectEqualsDeep(
  a: Record<string | number | symbol, unknown>,
  b: Record<string | number | symbol, unknown>,
  keys: string[],
  astack?: unknown[],
  bstack?: unknown[],
): boolean {
  let len = astack?.length ?? 0;
  while (len--) {
    if (astack && astack[len] === a) return bstack !== undefined && bstack[len] === b;
  }

  astack = astack ?? [];
  bstack = bstack ?? [];

  astack.push(a);
  bstack.push(b);

  len = keys.length;
  while (len--) {
    const key = keys[len]!;
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isEqualsDeep(a[key], b[key], astack, bstack)) return false;
  }

  bstack.pop();
  astack.pop();

  return true;
}

export function isEqualsDeep(a: unknown, b: unknown, astack?: unknown[], bstack?: unknown[]): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  switch (typeof a) {
    case "boolean":
      return a === b;
    case "number":
      if (Number.isNaN(a)) return Number.isNaN(b as number);
      return a === b;
    case "string":
      return a === b;
    case "object": {
      const arrays = Array.isArray(a);
      if (arrays && !Array.isArray(b)) return false;

      const objects = isObject(a);
      if (objects && !isObject(b)) return false;

      if (!arrays && !objects) return false;

      if (arrays && Array.isArray(b)) {
        if (a.length === b.length) {
          return arrayEqualsDeep(a, b, astack, bstack);
        }
      } else if (a && b) {
        const keys = Object.keys(a);
        if (keys.length === Object.keys(b as Record<string, unknown>).length) {
          return objectEqualsDeep(
            a as Record<string, unknown>,
            b as Record<string, unknown>,
            keys,
            astack,
            bstack,
          );
        }
      }
      break;
    }
    default:
      break;
  }
  return false;
}

export function arrayEqualsShallow(a?: unknown[], b?: unknown[]): boolean {
  return a === b || (a?.length === b?.length && !a?.some((va, vi) => b && va !== b[vi]));
}

export function chooseVariant(split: number[], prob: number): number {
  let cumSum = 0.0;
  for (let i = 0; i < split.length; ++i) {
    cumSum += split[i]!;
    if (prob < cumSum) return i;
  }
  return split.length - 1;
}
```

- [ ] **Step 5: Write src/algorithm.ts**

```typescript
export function insertUniqueSorted<TData>(
  arr: TData[],
  value: TData,
  isSorted: (a: TData, b: TData) => boolean,
): void {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);
    if (isSorted(arr[mid]!, value)) {
      left = mid + 1;
    } else if (isSorted(value, arr[mid]!)) {
      right = mid - 1;
    } else {
      return;
    }
  }

  arr.splice(left, 0, value);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/utils.test.ts src/__tests__/algorithm.test.ts`

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/utils.ts src/algorithm.ts src/__tests__/utils.test.ts src/__tests__/algorithm.test.ts
git commit -m "feat: add core utilities (isObject, isEqualsDeep, chooseVariant, insertUniqueSorted)"
```

---

## Task 7: Variant Assigner

**Files:**
- Create: `src/assigner.ts`
- Create: `src/__tests__/assigner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "vitest";
import { VariantAssigner } from "../assigner";
import { hashUnit } from "../hashing";

describe("VariantAssigner", () => {
  const testCases: Record<string, [number[], number, number, number][]> = {
    "bleh@absmartly.com": [
      [[0.5, 0.5], 0x00000000, 0x00000000, 0],
      [[0.5, 0.5], 0x00000000, 0x00000001, 1],
      [[0.5, 0.5], 0x8015406f, 0x7ef49b98, 0],
      [[0.5, 0.5], 0x3b2e7571, 0xca87df4d, 0],
      [[0.33, 0.33, 0.34], 0x00000000, 0x00000000, 0],
      [[0.33, 0.33, 0.34], 0x00000000, 0x00000001, 2],
      [[0.33, 0.33, 0.34], 0x8015406f, 0x7ef49b98, 0],
      [[0.33, 0.33, 0.34], 0x3b2e7571, 0xca87df4d, 0],
    ],
    "123456789": [
      [[0.5, 0.5], 0x00000000, 0x00000000, 1],
      [[0.5, 0.5], 0x00000000, 0x00000001, 0],
      [[0.5, 0.5], 0x8015406f, 0x7ef49b98, 1],
      [[0.5, 0.5], 0x3b2e7571, 0xca87df4d, 1],
      [[0.33, 0.33, 0.34], 0x00000000, 0x00000000, 2],
      [[0.33, 0.33, 0.34], 0x00000000, 0x00000001, 0],
      [[0.33, 0.33, 0.34], 0x8015406f, 0x7ef49b98, 2],
      [[0.33, 0.33, 0.34], 0x3b2e7571, 0xca87df4d, 1],
    ],
  };

  for (const [unit, cases] of Object.entries(testCases)) {
    describe(`unit: "${unit}"`, () => {
      const assigner = new VariantAssigner(hashUnit(unit));
      for (const [split, seedHi, seedLo, expected] of cases) {
        test(`assign([${split}], 0x${seedHi.toString(16)}, 0x${seedLo.toString(16)}) == ${expected}`, () => {
          expect(assigner.assign(split, seedHi, seedLo)).toBe(expected);
        });
      }
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/assigner.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/assigner.ts**

```typescript
import { chooseVariant } from "./utils";
import { stringToUint8Array } from "./hashing";
import { murmur3_32 } from "./murmur3";

export class VariantAssigner {
  private readonly _unitHash: number;

  constructor(unit: string) {
    this._unitHash = murmur3_32(stringToUint8Array(unit).buffer);
  }

  assign(split: number[], seedHi: number, seedLo: number): number {
    const prob = this._probability(seedHi, seedLo);
    return chooseVariant(split, prob);
  }

  private _probability(seedHi: number, seedLo: number): number {
    const key = this._unitHash;
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint32(0, seedLo, true);
    view.setUint32(4, seedHi, true);
    view.setUint32(8, key, true);
    return murmur3_32(buffer) * (1.0 / 0xffffffff);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/assigner.test.ts`

Expected: All 16 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/assigner.ts src/__tests__/assigner.test.ts
git commit -m "feat: add VariantAssigner with murmur3-based probability"
```

---

## Task 8: JsonExpr Evaluator

**Files:**
- Create: `src/jsonexpr/evaluator.ts`
- Create: `src/__tests__/jsonexpr/evaluator.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "vitest";
import { Evaluator } from "../../jsonexpr/evaluator";

function createEvaluator(vars: Record<string, unknown> = {}) {
  return new Evaluator({}, vars);
}

describe("Evaluator", () => {
  describe("booleanConvert", () => {
    const evaluator = createEvaluator();

    test("boolean values", () => {
      expect(evaluator.booleanConvert(true)).toBe(true);
      expect(evaluator.booleanConvert(false)).toBe(false);
    });

    test("number values", () => {
      expect(evaluator.booleanConvert(1)).toBe(true);
      expect(evaluator.booleanConvert(0)).toBe(false);
      expect(evaluator.booleanConvert(-1)).toBe(true);
    });

    test("string values", () => {
      expect(evaluator.booleanConvert("true")).toBe(true);
      expect(evaluator.booleanConvert("false")).toBe(false);
      expect(evaluator.booleanConvert("0")).toBe(false);
      expect(evaluator.booleanConvert("")).toBe(false);
      expect(evaluator.booleanConvert("abc")).toBe(true);
    });

    test("null/undefined", () => {
      expect(evaluator.booleanConvert(null)).toBe(false);
      expect(evaluator.booleanConvert(undefined)).toBe(false);
    });
  });

  describe("numberConvert", () => {
    const evaluator = createEvaluator();

    test("number values", () => {
      expect(evaluator.numberConvert(42)).toBe(42);
      expect(evaluator.numberConvert(0)).toBe(0);
      expect(evaluator.numberConvert(-1.5)).toBe(-1.5);
    });

    test("boolean values", () => {
      expect(evaluator.numberConvert(true)).toBe(1);
      expect(evaluator.numberConvert(false)).toBe(0);
    });

    test("string values", () => {
      expect(evaluator.numberConvert("42")).toBe(42);
      expect(evaluator.numberConvert("3.14")).toBe(3.14);
      expect(evaluator.numberConvert("abc")).toBe(null);
    });

    test("other types", () => {
      expect(evaluator.numberConvert(null)).toBe(null);
      expect(evaluator.numberConvert({})).toBe(null);
    });
  });

  describe("stringConvert", () => {
    const evaluator = createEvaluator();

    test("string values", () => {
      expect(evaluator.stringConvert("hello")).toBe("hello");
    });

    test("boolean values", () => {
      expect(evaluator.stringConvert(true)).toBe("true");
      expect(evaluator.stringConvert(false)).toBe("false");
    });

    test("number values", () => {
      expect(evaluator.stringConvert(42)).toBe("42");
      expect(evaluator.stringConvert(0)).toBe("0");
    });

    test("other types", () => {
      expect(evaluator.stringConvert(null)).toBe(null);
      expect(evaluator.stringConvert({})).toBe(null);
    });
  });

  describe("extractVar", () => {
    test("extracts top-level variable", () => {
      const evaluator = createEvaluator({ name: "John" });
      expect(evaluator.extractVar("name")).toBe("John");
    });

    test("extracts nested variable", () => {
      const evaluator = createEvaluator({ user: { name: "John" } });
      expect(evaluator.extractVar("user/name")).toBe("John");
    });

    test("returns null for missing path", () => {
      const evaluator = createEvaluator({ name: "John" });
      expect(evaluator.extractVar("missing")).toBe(null);
    });
  });

  describe("compare", () => {
    const evaluator = createEvaluator();

    test("numbers", () => {
      expect(evaluator.compare(1, 2)).toBe(-1);
      expect(evaluator.compare(2, 1)).toBe(1);
      expect(evaluator.compare(1, 1)).toBe(0);
    });

    test("strings", () => {
      expect(evaluator.compare("a", "b")).toBe(-1);
      expect(evaluator.compare("b", "a")).toBe(1);
      expect(evaluator.compare("a", "a")).toBe(0);
    });

    test("booleans", () => {
      expect(evaluator.compare(true, true)).toBe(0);
      expect(evaluator.compare(false, false)).toBe(0);
    });

    test("null handling", () => {
      expect(evaluator.compare(null, null)).toBe(0);
      expect(evaluator.compare(null, 1)).toBe(null);
      expect(evaluator.compare(1, null)).toBe(null);
    });
  });

  describe("versionCompare", () => {
    const evaluator = createEvaluator();

    test("equal versions", () => {
      expect(evaluator.versionCompare("1.0.0", "1.0.0")).toBe(0);
    });

    test("greater version", () => {
      expect(evaluator.versionCompare("2.0.0", "1.0.0")).toBe(1);
    });

    test("lesser version", () => {
      expect(evaluator.versionCompare("1.0.0", "2.0.0")).toBe(-1);
    });

    test("prerelease is less than release", () => {
      expect(evaluator.versionCompare("1.0.0-alpha", "1.0.0")).toBe(-1);
    });

    test("v prefix", () => {
      expect(evaluator.versionCompare("v1.0.0", "1.0.0")).toBe(0);
    });

    test("build metadata ignored", () => {
      expect(evaluator.versionCompare("1.0.0+build1", "1.0.0+build2")).toBe(0);
    });

    test("null inputs", () => {
      expect(evaluator.versionCompare(null, "1.0.0")).toBe(null);
      expect(evaluator.versionCompare("1.0.0", null)).toBe(null);
    });

    test("empty inputs", () => {
      expect(evaluator.versionCompare("", "1.0.0")).toBe(null);
      expect(evaluator.versionCompare("1.0.0", "")).toBe(null);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/jsonexpr/evaluator.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/jsonexpr/evaluator.ts**

Port the evaluator verbatim from the original. The implementation is in the code read earlier (`src/jsonexpr/evaluator.ts` from original codebase). Copy it with proper strict TypeScript typing:

```typescript
import { isEqualsDeep, isObject } from "../utils";

export interface Operator {
  evaluate(evaluator: Evaluator, args: unknown): unknown;
}

function parseSemver(version: string) {
  let v = version;
  if (v.startsWith("v") || v.startsWith("V")) {
    v = v.substring(1);
  }

  const plusIndex = v.indexOf("+");
  if (plusIndex >= 0) {
    v = v.substring(0, plusIndex);
  }

  if (v === "") return null;

  const [core, ...preReleaseParts] = v.split("-");
  const preRelease = preReleaseParts.join("-");

  if (core === "") return null;

  const parts = core!.split(".");
  return { parts, preRelease };
}

const NUMERIC_IDENTIFIER = /^\d+$/;

function stripLeadingZeros(s: string): string {
  const stripped = s.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

function compareIdentifiers(a: string, b: string): number {
  const aIsNum = NUMERIC_IDENTIFIER.test(a);
  const bIsNum = NUMERIC_IDENTIFIER.test(b);

  if (aIsNum && bIsNum) {
    const aNorm = stripLeadingZeros(a);
    const bNorm = stripLeadingZeros(b);
    if (aNorm.length !== bNorm.length) return aNorm.length > bNorm.length ? 1 : -1;
    return aNorm === bNorm ? 0 : aNorm > bNorm ? 1 : -1;
  }
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return a === b ? 0 : a > b ? 1 : -1;
}

export class Evaluator {
  private readonly operators: Record<string, Operator>;
  private readonly vars: Record<string, unknown>;

  constructor(operators: Record<string, Operator>, vars: Record<string, unknown>) {
    this.operators = operators;
    this.vars = vars;
  }

  evaluate(expr: unknown): unknown {
    if (Array.isArray(expr)) {
      return this.operators["and"]?.evaluate(this, expr) ?? null;
    } else if (isObject(expr)) {
      for (const [key, value] of Object.entries(expr)) {
        const op = this.operators[key];
        if (op !== undefined) {
          return op.evaluate(this, value);
        }
        break;
      }
    }
    return null;
  }

  booleanConvert(x: unknown): boolean {
    const type = typeof x;
    switch (type) {
      case "boolean":
        return x as boolean;
      case "number":
        return x !== 0;
      case "string":
        return x !== "false" && x !== "0" && x !== "";
      default:
        return x !== null && x !== undefined;
    }
  }

  numberConvert(x: unknown): number | null {
    switch (typeof x) {
      case "number":
        return x;
      case "boolean":
        return x ? 1 : 0;
      case "string": {
        const y = parseFloat(x);
        return Number.isFinite(y) ? y : null;
      }
      default:
        return null;
    }
  }

  stringConvert(x: unknown): string | null {
    switch (typeof x) {
      case "string":
        return x;
      case "boolean":
        return x.toString();
      case "number":
        return x.toFixed(15).replace(/\.?0{0,15}$/, "");
      default:
        return null;
    }
  }

  extractVar(path: string): unknown {
    const frags = path.split("/");
    let target: unknown = this.vars ?? {};
    for (const frag of frags) {
      if (target !== null && typeof target === "object" && frag in (target as Record<string, unknown>)) {
        target = (target as Record<string, unknown>)[frag];
        continue;
      }
      return null;
    }
    return target;
  }

  versionCompare(lhs: unknown, rhs: unknown): number | null {
    const lhsStr = this.stringConvert(lhs);
    const rhsStr = this.stringConvert(rhs);
    if (lhsStr === null || rhsStr === null || lhsStr === "" || rhsStr === "") return null;

    const l = parseSemver(lhsStr);
    const r = parseSemver(rhsStr);
    if (l === null || r === null) return null;

    const maxLen = Math.max(l.parts.length, r.parts.length);
    for (let i = 0; i < maxLen; i++) {
      const lPart = l.parts[i] ?? "0";
      const rPart = r.parts[i] ?? "0";
      const result = compareIdentifiers(lPart, rPart);
      if (result !== 0) return result;
    }

    if (!l.preRelease && !r.preRelease) return 0;
    if (!l.preRelease) return 1;
    if (!r.preRelease) return -1;

    const lPreParts = l.preRelease.split(".");
    const rPreParts = r.preRelease.split(".");
    const preLen = Math.max(lPreParts.length, rPreParts.length);
    for (let i = 0; i < preLen; i++) {
      if (i >= lPreParts.length) return -1;
      if (i >= rPreParts.length) return 1;
      const result = compareIdentifiers(lPreParts[i]!, rPreParts[i]!);
      if (result !== 0) return result;
    }

    return 0;
  }

  compare(lhs: unknown, rhs: unknown): number | null {
    if (lhs === null) return rhs === null ? 0 : null;
    if (rhs === null) return null;

    switch (typeof lhs) {
      case "number": {
        const rvalue = this.numberConvert(rhs);
        if (rvalue !== null) return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
        break;
      }
      case "string": {
        const rvalue = this.stringConvert(rhs);
        if (rvalue !== null) return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
        break;
      }
      case "boolean": {
        const rvalue = this.booleanConvert(rhs);
        if (rvalue != null) return lhs === rvalue ? 0 : lhs > rvalue ? 1 : -1;
        break;
      }
      default: {
        if (isEqualsDeep(lhs, rhs)) return 0;
        break;
      }
    }

    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/jsonexpr/evaluator.test.ts`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/jsonexpr/evaluator.ts src/__tests__/jsonexpr/evaluator.test.ts
git commit -m "feat: add JsonExpr evaluator with type conversion and comparison"
```

---

## Task 9: JsonExpr Operators

**Files:**
- Create: `src/jsonexpr/operators.ts`
- Create: `src/__tests__/jsonexpr/operators.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "vitest";
import { Evaluator } from "../../jsonexpr/evaluator";
import {
  AndCombinator,
  EqualsOperator,
  GreaterThanOperator,
  GreaterThanOrEqualOperator,
  InOperator,
  LessThanOperator,
  LessThanOrEqualOperator,
  MatchOperator,
  NotOperator,
  NullOperator,
  OrCombinator,
  SemverEqualsOperator,
  SemverGreaterThanOperator,
  SemverGreaterThanOrEqualOperator,
  SemverLessThanOperator,
  SemverLessThanOrEqualOperator,
  ValueOperator,
  VarOperator,
} from "../../jsonexpr/operators";

function makeEvaluator(vars: Record<string, unknown> = {}): Evaluator {
  const operators = {
    and: new AndCombinator(),
    or: new OrCombinator(),
    value: new ValueOperator(),
    var: new VarOperator(),
    null: new NullOperator(),
    not: new NotOperator(),
    in: new InOperator(),
    match: new MatchOperator(),
    eq: new EqualsOperator(),
    gt: new GreaterThanOperator(),
    gte: new GreaterThanOrEqualOperator(),
    lt: new LessThanOperator(),
    lte: new LessThanOrEqualOperator(),
    semver_eq: new SemverEqualsOperator(),
    semver_gt: new SemverGreaterThanOperator(),
    semver_gte: new SemverGreaterThanOrEqualOperator(),
    semver_lt: new SemverLessThanOperator(),
    semver_lte: new SemverLessThanOrEqualOperator(),
  };
  return new Evaluator(operators, vars);
}

describe("ValueOperator", () => {
  test("returns the value as-is", () => {
    const evaluator = makeEvaluator();
    const op = new ValueOperator();
    expect(op.evaluate(evaluator, 42)).toBe(42);
    expect(op.evaluate(evaluator, "hello")).toBe("hello");
    expect(op.evaluate(evaluator, null)).toBe(null);
  });
});

describe("VarOperator", () => {
  test("extracts variable by path string", () => {
    const evaluator = makeEvaluator({ name: "John", nested: { key: "val" } });
    const op = new VarOperator();
    expect(op.evaluate(evaluator, "name")).toBe("John");
    expect(op.evaluate(evaluator, "nested/key")).toBe("val");
  });

  test("extracts variable by path object", () => {
    const evaluator = makeEvaluator({ name: "John" });
    const op = new VarOperator();
    expect(op.evaluate(evaluator, { path: "name" })).toBe("John");
  });

  test("returns null for non-string path", () => {
    const evaluator = makeEvaluator();
    const op = new VarOperator();
    expect(op.evaluate(evaluator, 42)).toBe(null);
  });
});

describe("AndCombinator", () => {
  test("returns true when all truthy", () => {
    const evaluator = makeEvaluator();
    const op = new AndCombinator();
    expect(op.evaluate(evaluator, [{ value: true }, { value: 1 }])).toBe(true);
  });

  test("returns false when any falsy", () => {
    const evaluator = makeEvaluator();
    const op = new AndCombinator();
    expect(op.evaluate(evaluator, [{ value: true }, { value: false }])).toBe(false);
  });

  test("returns true for empty array", () => {
    const evaluator = makeEvaluator();
    const op = new AndCombinator();
    expect(op.evaluate(evaluator, [])).toBe(true);
  });
});

describe("OrCombinator", () => {
  test("returns true when any truthy", () => {
    const evaluator = makeEvaluator();
    const op = new OrCombinator();
    expect(op.evaluate(evaluator, [{ value: false }, { value: true }])).toBe(true);
  });

  test("returns false when all falsy", () => {
    const evaluator = makeEvaluator();
    const op = new OrCombinator();
    expect(op.evaluate(evaluator, [{ value: false }, { value: 0 }])).toBe(false);
  });

  test("returns true for empty array (vacuous truth)", () => {
    const evaluator = makeEvaluator();
    const op = new OrCombinator();
    expect(op.evaluate(evaluator, [])).toBe(true);
  });
});

describe("NotOperator", () => {
  test("negates boolean", () => {
    const evaluator = makeEvaluator();
    const op = new NotOperator();
    expect(op.evaluate(evaluator, { value: true })).toBe(false);
    expect(op.evaluate(evaluator, { value: false })).toBe(true);
  });
});

describe("NullOperator", () => {
  test("checks if value is null", () => {
    const evaluator = makeEvaluator();
    const op = new NullOperator();
    expect(op.evaluate(evaluator, { value: null })).toBe(true);
    expect(op.evaluate(evaluator, { value: 0 })).toBe(false);
  });
});

describe("EqualsOperator", () => {
  test("compares values for equality", () => {
    const evaluator = makeEvaluator();
    const op = new EqualsOperator();
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 1 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 2 }])).toBe(false);
    expect(op.evaluate(evaluator, [{ value: "a" }, { value: "a" }])).toBe(true);
  });
});

describe("Comparison operators", () => {
  const evaluator = makeEvaluator();

  test("GreaterThan", () => {
    const op = new GreaterThanOperator();
    expect(op.evaluate(evaluator, [{ value: 2 }, { value: 1 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 2 }])).toBe(false);
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 1 }])).toBe(false);
  });

  test("GreaterThanOrEqual", () => {
    const op = new GreaterThanOrEqualOperator();
    expect(op.evaluate(evaluator, [{ value: 2 }, { value: 1 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 1 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 2 }])).toBe(false);
  });

  test("LessThan", () => {
    const op = new LessThanOperator();
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 2 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: 2 }, { value: 1 }])).toBe(false);
  });

  test("LessThanOrEqual", () => {
    const op = new LessThanOrEqualOperator();
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 2 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: 1 }, { value: 1 }])).toBe(true);
  });
});

describe("InOperator", () => {
  const evaluator = makeEvaluator();
  const op = new InOperator();

  test("array membership", () => {
    expect(op.evaluate(evaluator, [{ value: [1, 2, 3] }, { value: 2 }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: [1, 2, 3] }, { value: 4 }])).toBe(false);
  });

  test("string containment", () => {
    expect(op.evaluate(evaluator, [{ value: "hello world" }, { value: "world" }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: "hello" }, { value: "world" }])).toBe(false);
  });

  test("object key check", () => {
    expect(op.evaluate(evaluator, [{ value: { a: 1 } }, { value: "a" }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: { a: 1 } }, { value: "b" }])).toBe(false);
  });
});

describe("MatchOperator", () => {
  const evaluator = makeEvaluator();
  const op = new MatchOperator();

  test("matches regex", () => {
    expect(op.evaluate(evaluator, [{ value: "hello123" }, { value: "\\d+" }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: "hello" }, { value: "\\d+" }])).toBe(false);
  });
});

describe("Semver operators", () => {
  const evaluator = makeEvaluator();

  test("semver_eq", () => {
    const op = new SemverEqualsOperator();
    expect(op.evaluate(evaluator, [{ value: "1.0.0" }, { value: "1.0.0" }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: "1.0.0" }, { value: "1.0.1" }])).toBe(false);
  });

  test("semver_gt", () => {
    const op = new SemverGreaterThanOperator();
    expect(op.evaluate(evaluator, [{ value: "2.0.0" }, { value: "1.0.0" }])).toBe(true);
    expect(op.evaluate(evaluator, [{ value: "1.0.0" }, { value: "2.0.0" }])).toBe(false);
  });

  test("semver_gte", () => {
    const op = new SemverGreaterThanOrEqualOperator();
    expect(op.evaluate(evaluator, [{ value: "1.0.0" }, { value: "1.0.0" }])).toBe(true);
  });

  test("semver_lt", () => {
    const op = new SemverLessThanOperator();
    expect(op.evaluate(evaluator, [{ value: "1.0.0" }, { value: "2.0.0" }])).toBe(true);
  });

  test("semver_lte", () => {
    const op = new SemverLessThanOrEqualOperator();
    expect(op.evaluate(evaluator, [{ value: "1.0.0" }, { value: "1.0.0" }])).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/jsonexpr/operators.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/jsonexpr/operators.ts**

All 20 operators consolidated in one file:

```typescript
import { Evaluator } from "./evaluator";
import { isObject } from "../utils";

export class ValueOperator {
  evaluate(_: Evaluator, value: unknown): unknown {
    return value;
  }
}

export class VarOperator {
  evaluate(evaluator: Evaluator, path: unknown): unknown {
    if (isObject(path)) {
      path = (path as { path: string }).path;
    }
    return typeof path === "string" ? evaluator.extractVar(path) : null;
  }
}

export class AndCombinator {
  evaluate(evaluator: Evaluator, args: unknown): boolean | null {
    if (Array.isArray(args)) {
      for (const expr of args) {
        if (!evaluator.booleanConvert(evaluator.evaluate(expr))) return false;
      }
      return true;
    }
    return null;
  }
}

export class OrCombinator {
  evaluate(evaluator: Evaluator, args: unknown): boolean | null {
    if (Array.isArray(args)) {
      for (const expr of args) {
        if (evaluator.booleanConvert(evaluator.evaluate(expr))) return true;
      }
      return args.length === 0;
    }
    return null;
  }
}

abstract class UnaryOperator {
  abstract unary(evaluator: Evaluator, arg: unknown): boolean;
  evaluate(evaluator: Evaluator, arg: unknown): boolean {
    arg = evaluator.evaluate(arg);
    return this.unary(evaluator, arg);
  }
}

export class NotOperator extends UnaryOperator {
  unary(evaluator: Evaluator, arg: unknown): boolean {
    return !evaluator.booleanConvert(arg);
  }
}

export class NullOperator extends UnaryOperator {
  unary(_: Evaluator, value: unknown): boolean {
    return value === null;
  }
}

abstract class BinaryOperator {
  abstract binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null;
  evaluate(evaluator: Evaluator, args: unknown): boolean | null {
    if (Array.isArray(args)) {
      const lhs = args.length > 0 ? evaluator.evaluate(args[0]) : null;
      if (lhs !== null) {
        const rhs = args.length > 1 ? evaluator.evaluate(args[1]) : null;
        if (rhs !== null) {
          return this.binary(evaluator, lhs, rhs);
        }
      }
    }
    return null;
  }
}

export class EqualsOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.compare(lhs, rhs);
    return result !== null ? result === 0 : null;
  }
}

export class GreaterThanOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.compare(lhs, rhs);
    return result !== null ? result > 0 : null;
  }
}

export class GreaterThanOrEqualOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.compare(lhs, rhs);
    return result !== null ? result >= 0 : null;
  }
}

export class LessThanOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.compare(lhs, rhs);
    return result !== null ? result < 0 : null;
  }
}

export class LessThanOrEqualOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.compare(lhs, rhs);
    return result !== null ? result <= 0 : null;
  }
}

export class InOperator extends BinaryOperator {
  binary(evaluator: Evaluator, haystack: unknown, needle: unknown): boolean | null {
    if (Array.isArray(haystack)) {
      for (const item of haystack) {
        if (evaluator.compare(item, needle) === 0) return true;
      }
      return false;
    } else if (typeof haystack === "string") {
      const needleString = evaluator.stringConvert(needle);
      return needleString !== null && haystack.includes(needleString);
    } else if (isObject(haystack)) {
      const needleString = evaluator.stringConvert(needle);
      return needleString != null && Object.prototype.hasOwnProperty.call(haystack, needleString);
    }
    return null;
  }
}

export class MatchOperator extends BinaryOperator {
  binary(evaluator: Evaluator, text: unknown, pattern: unknown): boolean | null {
    const textStr = evaluator.stringConvert(text);
    if (textStr !== null) {
      const patternStr = evaluator.stringConvert(pattern);
      if (patternStr !== null) {
        try {
          return new RegExp(patternStr).test(textStr);
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

export class SemverEqualsOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.versionCompare(lhs, rhs);
    return result !== null ? result === 0 : null;
  }
}

export class SemverGreaterThanOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.versionCompare(lhs, rhs);
    return result !== null ? result > 0 : null;
  }
}

export class SemverGreaterThanOrEqualOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.versionCompare(lhs, rhs);
    return result !== null ? result >= 0 : null;
  }
}

export class SemverLessThanOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.versionCompare(lhs, rhs);
    return result !== null ? result < 0 : null;
  }
}

export class SemverLessThanOrEqualOperator extends BinaryOperator {
  binary(evaluator: Evaluator, lhs: unknown, rhs: unknown): boolean | null {
    const result = evaluator.versionCompare(lhs, rhs);
    return result !== null ? result <= 0 : null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/jsonexpr/operators.test.ts`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/jsonexpr/operators.ts src/__tests__/jsonexpr/operators.test.ts
git commit -m "feat: add all 20 JsonExpr operators"
```

---

## Task 10: JsonExpr Facade & AudienceMatcher

**Files:**
- Create: `src/jsonexpr/jsonexpr.ts`
- Create: `src/matcher.ts`
- Create: `src/__tests__/jsonexpr/jsonexpr.test.ts`
- Create: `src/__tests__/matcher.test.ts`

- [ ] **Step 1: Write the failing tests for JsonExpr**

```typescript
import { describe, expect, test } from "vitest";
import { JsonExpr } from "../../jsonexpr/jsonexpr";

describe("JsonExpr", () => {
  const jsonExpr = new JsonExpr();

  test("evaluateBooleanExpr with and-array", () => {
    expect(jsonExpr.evaluateBooleanExpr([{ value: true }, { value: 1 }], {})).toBe(true);
    expect(jsonExpr.evaluateBooleanExpr([{ value: true }, { value: false }], {})).toBe(false);
  });

  test("evaluateBooleanExpr with object expr", () => {
    expect(jsonExpr.evaluateBooleanExpr({ value: true }, {})).toBe(true);
    expect(jsonExpr.evaluateBooleanExpr({ value: false }, {})).toBe(false);
  });

  test("evaluateExpr returns raw value", () => {
    expect(jsonExpr.evaluateExpr({ value: 42 }, {})).toBe(42);
    expect(jsonExpr.evaluateExpr({ value: "hello" }, {})).toBe("hello");
  });

  test("var operator extracts from vars", () => {
    expect(jsonExpr.evaluateExpr({ var: "name" }, { name: "Alice" })).toBe("Alice");
  });

  test("complex expression with eq and var", () => {
    const expr = { eq: [{ var: "age" }, { value: 25 }] };
    expect(jsonExpr.evaluateBooleanExpr(expr, { age: 25 })).toBe(true);
    expect(jsonExpr.evaluateBooleanExpr(expr, { age: 30 })).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing tests for AudienceMatcher**

```typescript
import { describe, expect, test } from "vitest";
import { AudienceMatcher } from "../matcher";

describe("AudienceMatcher", () => {
  const matcher = new AudienceMatcher();

  test("evaluates matching audience", () => {
    const audience = JSON.stringify({ filter: [{ value: true }] });
    expect(matcher.evaluate(audience, {})).toBe(true);
  });

  test("evaluates non-matching audience", () => {
    const audience = JSON.stringify({ filter: [{ value: false }] });
    expect(matcher.evaluate(audience, {})).toBe(false);
  });

  test("evaluates with not operator", () => {
    const audience = JSON.stringify({ filter: [{ not: { value: false } }] });
    expect(matcher.evaluate(audience, {})).toBe(true);
  });

  test("returns null for invalid JSON", () => {
    expect(matcher.evaluate("invalid json", {})).toBe(null);
  });

  test("returns null for missing filter", () => {
    expect(matcher.evaluate(JSON.stringify({}), {})).toBe(null);
  });

  test("returns null for null filter", () => {
    expect(matcher.evaluate(JSON.stringify({ filter: null }), {})).toBe(null);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/jsonexpr/jsonexpr.test.ts src/__tests__/matcher.test.ts`

Expected: FAIL - modules not found

- [ ] **Step 4: Write src/jsonexpr/jsonexpr.ts**

```typescript
import { Evaluator } from "./evaluator";
import {
  AndCombinator,
  EqualsOperator,
  GreaterThanOperator,
  GreaterThanOrEqualOperator,
  InOperator,
  LessThanOperator,
  LessThanOrEqualOperator,
  MatchOperator,
  NotOperator,
  NullOperator,
  OrCombinator,
  SemverEqualsOperator,
  SemverGreaterThanOperator,
  SemverGreaterThanOrEqualOperator,
  SemverLessThanOperator,
  SemverLessThanOrEqualOperator,
  ValueOperator,
  VarOperator,
} from "./operators";

const operators = {
  and: new AndCombinator(),
  or: new OrCombinator(),
  value: new ValueOperator(),
  var: new VarOperator(),
  null: new NullOperator(),
  not: new NotOperator(),
  in: new InOperator(),
  match: new MatchOperator(),
  eq: new EqualsOperator(),
  gt: new GreaterThanOperator(),
  gte: new GreaterThanOrEqualOperator(),
  lt: new LessThanOperator(),
  lte: new LessThanOrEqualOperator(),
  semver_eq: new SemverEqualsOperator(),
  semver_gt: new SemverGreaterThanOperator(),
  semver_gte: new SemverGreaterThanOrEqualOperator(),
  semver_lt: new SemverLessThanOperator(),
  semver_lte: new SemverLessThanOrEqualOperator(),
};

export class JsonExpr {
  evaluateBooleanExpr(expr: unknown, vars: Record<string, unknown>): boolean {
    const evaluator = new Evaluator(operators, vars);
    return evaluator.booleanConvert(evaluator.evaluate(expr));
  }

  evaluateExpr(expr: unknown, vars: Record<string, unknown>): unknown {
    const evaluator = new Evaluator(operators, vars);
    return evaluator.evaluate(expr);
  }
}
```

- [ ] **Step 5: Write src/matcher.ts**

```typescript
import { isObject } from "./utils";
import { JsonExpr } from "./jsonexpr/jsonexpr";

export class AudienceMatcher {
  private readonly _jsonExpr = new JsonExpr();

  evaluate(audienceString: string, vars: Record<string, unknown>): boolean | null {
    try {
      const audience = JSON.parse(audienceString);
      if (audience && audience.filter) {
        if (Array.isArray(audience.filter) || isObject(audience.filter)) {
          return this._jsonExpr.evaluateBooleanExpr(audience.filter, vars);
        }
      }
    } catch {
      // invalid JSON
    }
    return null;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/jsonexpr/jsonexpr.test.ts src/__tests__/matcher.test.ts`

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/jsonexpr/jsonexpr.ts src/matcher.ts src/__tests__/jsonexpr/jsonexpr.test.ts src/__tests__/matcher.test.ts
git commit -m "feat: add JsonExpr facade and AudienceMatcher"
```

---

## Task 11: HTTP Client

**Files:**
- Create: `src/client.ts`
- Create: `src/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { Client } from "../client";
import type { ClientOptions } from "../types";

const defaultOpts: ClientOptions = {
  agent: "test-agent",
  apiKey: "test-api-key",
  application: "test-app",
  endpoint: "https://test.absmartly.io/v1",
  environment: "test",
};

describe("Client", () => {
  describe("constructor validation", () => {
    test("throws for missing apiKey", () => {
      const opts = { ...defaultOpts, apiKey: undefined } as unknown as ClientOptions;
      expect(() => new Client(opts)).toThrow("Missing 'apiKey' in options argument");
    });

    test("throws for missing endpoint", () => {
      const opts = { ...defaultOpts, endpoint: undefined } as unknown as ClientOptions;
      expect(() => new Client(opts)).toThrow("Missing 'endpoint' in options argument");
    });

    test("throws for missing environment", () => {
      const opts = { ...defaultOpts, environment: undefined } as unknown as ClientOptions;
      expect(() => new Client(opts)).toThrow("Missing 'environment' in options argument");
    });

    test("throws for missing application", () => {
      const opts = { ...defaultOpts, application: undefined } as unknown as ClientOptions;
      expect(() => new Client(opts)).toThrow("Missing 'application' in options argument");
    });

    test("throws for empty apiKey", () => {
      const opts = { ...defaultOpts, apiKey: "" };
      expect(() => new Client(opts)).toThrow("Invalid 'apiKey' in options argument");
    });

    test("accepts ApplicationObject", () => {
      const opts = { ...defaultOpts, application: { name: "my-app", version: "1.0.0" } };
      const client = new Client(opts);
      expect(client.getApplication()).toEqual({ name: "my-app", version: "1.0.0" });
    });

    test("converts string application to ApplicationObject", () => {
      const client = new Client(defaultOpts);
      expect(client.getApplication()).toEqual({ name: "test-app", version: 0 });
    });
  });

  describe("accessors", () => {
    test("getAgent", () => {
      const client = new Client(defaultOpts);
      expect(client.getAgent()).toBe("test-agent");
    });

    test("getEnvironment", () => {
      const client = new Client(defaultOpts);
      expect(client.getEnvironment()).toBe("test");
    });
  });

  describe("getContext", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("makes GET request to /context", async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ experiments: [] }) };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000 });
      await client.getContext();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toContain("/context");
      expect(url).toContain("application=test-app");
      expect(url).toContain("environment=test");
    });
  });

  describe("publish", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("makes PUT request to /context with auth headers", async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({}) };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000 });
      await client.publish({
        units: [{ type: "session_id", uid: "abc" }],
        publishedAt: 1000,
        hashed: true,
        sdkVersion: "2.0.0",
      });

      const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(opts.method).toBe("PUT");
      expect(opts.headers["X-API-Key"]).toBe("test-api-key");
      expect(opts.headers["X-Agent"]).toBe("test-agent");
      expect(opts.headers["X-Environment"]).toBe("test");
    });

    test("omits empty goals and exposures arrays", async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({}) };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const client = new Client({ ...defaultOpts, retries: 0, timeout: 1000 });
      await client.publish({
        units: [{ type: "session_id", uid: "abc" }],
        publishedAt: 1000,
        hashed: true,
        sdkVersion: "2.0.0",
        goals: [],
        exposures: [],
      });

      const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const body = JSON.parse(opts.body);
      expect(body.goals).toBeUndefined();
      expect(body.exposures).toBeUndefined();
    });
  });

  describe("retry logic", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    test("retries on server error", async () => {
      const failResponse = { ok: false, status: 500, statusText: "Server Error", text: () => Promise.resolve("") };
      const successResponse = { ok: true, json: () => Promise.resolve({ data: "ok" }) };

      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(failResponse)
        .mockResolvedValueOnce(successResponse);

      const client = new Client({ ...defaultOpts, retries: 3, timeout: 10000 });
      const promise = client.getContext();

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ data: "ok" });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test("does not retry on 4xx error", async () => {
      const failResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("bad request"),
      };

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(failResponse);

      const client = new Client({ ...defaultOpts, retries: 3, timeout: 10000 });
      const promise = client.getContext();

      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("bad request");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/client.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/client.ts**

```typescript
import { AbortError, RetryError, TimeoutError } from "./errors";
import type {
  ApplicationObject,
  ClientOptions,
  ClientRequestOptions,
  ContextOptions,
  ContextParams,
  FetchResponse,
  NormalizedClientOptions,
  PublishParams,
} from "./types";

export class Client {
  private readonly _opts: NormalizedClientOptions;
  private readonly _delay: number;

  constructor(opts: ClientOptions) {
    const merged: Record<string, unknown> = Object.assign(
      { agent: "javascript-client", retries: 5, timeout: 3000, keepalive: true },
      opts,
    );

    for (const key of ["agent", "application", "apiKey", "endpoint", "environment"]) {
      if (key in merged && merged[key] !== undefined) {
        const value = merged[key];
        if (typeof value !== "string" || (value as string).length === 0) {
          if (key === "application") {
            if (value !== null && typeof value === "object" && "name" in (value as object)) continue;
          }
          throw new Error(`Invalid '${key}' in options argument`);
        }
      } else {
        throw new Error(`Missing '${key}' in options argument`);
      }
    }

    if (typeof merged.application === "string") {
      merged.application = { name: merged.application, version: 0 };
    }

    this._opts = merged as unknown as NormalizedClientOptions;
    this._delay = 50;
  }

  getContext(options?: Partial<ClientRequestOptions>): Promise<unknown> {
    return this.getUnauthed({
      ...options,
      path: "/context",
      query: {
        application: this._opts.application.name,
        environment: this._opts.environment,
      },
    });
  }

  createContext(params: ContextParams, options: ContextOptions): Promise<unknown> {
    return this.post({ ...options, path: "/context", body: { units: params.units } });
  }

  publish(params: PublishParams, options?: ClientRequestOptions): Promise<unknown> {
    const body: Record<string, unknown> = {
      units: params.units,
      hashed: params.hashed,
      publishedAt: params.publishedAt || Date.now(),
      sdkVersion: params.sdkVersion,
    };

    if (Array.isArray(params.goals) && params.goals.length > 0) {
      body.goals = params.goals;
    }
    if (Array.isArray(params.exposures) && params.exposures.length > 0) {
      body.exposures = params.exposures;
    }
    if (Array.isArray(params.attributes) && params.attributes.length > 0) {
      body.attributes = params.attributes;
    }

    return this.put({ ...options, path: "/context", body });
  }

  request(options: ClientRequestOptions): Promise<unknown> {
    let url = `${this._opts.endpoint}${options.path}`;
    if (options.query) {
      const keys = Object.keys(options.query);
      if (keys.length > 0) {
        const encoded = keys
          .map((k) => (options.query ? `${k}=${encodeURIComponent(options.query[k]!)}` : null))
          .join("&");
        url = `${url}?${encoded}`;
      }
    }

    const controller = new AbortController();

    const tryOnce = (): Promise<unknown> => {
      const opts: RequestInit = {
        method: options.method,
        body: options.body !== undefined ? JSON.stringify(options.body, null, 0) : undefined,
        signal: controller.signal,
        keepalive: this._opts.keepalive,
      };

      if (options.auth) {
        opts.headers = {
          "Content-Type": "application/json",
          "X-API-Key": this._opts.apiKey,
          "X-Agent": this._opts.agent,
          "X-Environment": this._opts.environment,
          "X-Application": this._opts.application.name,
          "X-Application-Version": String(this._opts.application.version),
        };
      }

      return fetch(url, opts).then((response: Response) => {
        if (!response.ok) {
          const bail = response.status >= 400 && response.status < 500;
          return response.text().then((text: string) => {
            const error: Error & { _bail?: boolean } = new Error(
              text !== null && text.length > 0 ? text : response.statusText,
            );
            error._bail = bail;
            return Promise.reject(error);
          });
        }
        return response.json();
      });
    };

    type WaitFn = ((ms: number) => Promise<void>) & { reject?: (reason: AbortError) => void };
    type TryWithFn = ((retries: number, timeout: number, tries?: number, waited?: number) => Promise<unknown>) & {
      timedout?: boolean;
    };

    const wait: WaitFn = (ms) =>
      new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          delete wait.reject;
          resolve();
        }, ms);

        wait.reject = (reason) => {
          clearTimeout(timeoutId);
          reject(reason);
        };
      });

    const tryWith: TryWithFn = (retries, timeout, tries = 0, waited = 0) => {
      delete tryWith.timedout;

      return tryOnce().catch((reason: Error & { _bail?: boolean }) => {
        if (reason._bail || retries <= 0) throw new Error(reason.message);
        if (tries >= retries) throw new RetryError(tries, reason, url);
        if (waited >= timeout || reason.name === "AbortError") {
          if (tryWith.timedout) throw new TimeoutError(timeout);
          throw reason;
        }

        let delay = (1 << tries) * this._delay + 0.5 * Math.random() * this._delay;
        if (waited + delay > timeout) delay = timeout - waited;

        return wait(delay).then(() => tryWith(retries, timeout, tries + 1, waited + delay));
      });
    };

    const abort = () => {
      if (wait.reject) {
        wait.reject(new AbortError());
      } else {
        controller.abort();
      }
    };

    if (options.signal) {
      options.signal.addEventListener("abort", abort);
    }

    const timeout = options.timeout || this._opts.timeout || 0;
    const timeoutId =
      timeout > 0
        ? setTimeout(() => {
            tryWith.timedout = true;
            abort();
          }, timeout)
        : 0;

    const finalCleanUp = () => {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener("abort", abort);
      }
    };

    return tryWith(this._opts.retries ?? 5, this._opts.timeout ?? 3000)
      .then((value) => {
        finalCleanUp();
        return value;
      })
      .catch((error: Error) => {
        finalCleanUp();
        throw error;
      });
  }

  post(options: ClientRequestOptions): Promise<unknown> {
    return this.request({ ...options, auth: true, method: "POST" });
  }

  put(options: ClientRequestOptions): Promise<unknown> {
    return this.request({ ...options, auth: true, method: "PUT" });
  }

  getAgent(): string {
    return this._opts.agent;
  }

  getApplication(): ApplicationObject {
    return this._opts.application;
  }

  getEnvironment(): string {
    return this._opts.environment;
  }

  getUnauthed(options: ClientRequestOptions): Promise<unknown> {
    return this.request({ ...options, method: "GET" });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/client.test.ts`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/client.ts src/__tests__/client.test.ts
git commit -m "feat: add HTTP client with retry logic and exponential backoff"
```

---

## Task 12: Provider & Publisher

**Files:**
- Create: `src/provider.ts`
- Create: `src/publisher.ts`
- Create: `src/__tests__/provider.test.ts`
- Create: `src/__tests__/publisher.test.ts`

- [ ] **Step 1: Write the failing tests for provider**

```typescript
import { describe, expect, test, vi } from "vitest";
import { ContextDataProvider } from "../provider";

describe("ContextDataProvider", () => {
  test("delegates to sdk.getClient().getContext()", async () => {
    const mockGetContext = vi.fn().mockResolvedValue({ experiments: [] });
    const mockSdk = { getClient: () => ({ getContext: mockGetContext }) };

    const provider = new ContextDataProvider();
    const result = await provider.getContextData(mockSdk, { path: "/test" });

    expect(mockGetContext).toHaveBeenCalledWith({ path: "/test" });
    expect(result).toEqual({ experiments: [] });
  });
});
```

- [ ] **Step 2: Write the failing tests for publisher**

```typescript
import { describe, expect, test, vi } from "vitest";
import { ContextPublisher } from "../publisher";

describe("ContextPublisher", () => {
  test("delegates to sdk.getClient().publish()", async () => {
    const mockPublish = vi.fn().mockResolvedValue({});
    const mockSdk = { getClient: () => ({ publish: mockPublish }) };
    const request = {
      units: [{ type: "session_id", uid: "abc" }],
      publishedAt: 1000,
      hashed: true,
      sdkVersion: "2.0.0",
    };

    const publisher = new ContextPublisher();
    await publisher.publish(request, mockSdk, {}, { path: "/test" });

    expect(mockPublish).toHaveBeenCalledWith(request, { path: "/test" });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/provider.test.ts src/__tests__/publisher.test.ts`

Expected: FAIL - modules not found

- [ ] **Step 4: Write src/provider.ts**

```typescript
import type { ClientRequestOptions, ContextData } from "./types";

interface SDKLike {
  getClient(): { getContext(options?: Partial<ClientRequestOptions>): Promise<ContextData> };
}

export class ContextDataProvider {
  getContextData(sdk: SDKLike, requestOptions?: Partial<ClientRequestOptions>): Promise<ContextData> {
    return sdk.getClient().getContext(requestOptions) as Promise<ContextData>;
  }
}
```

- [ ] **Step 5: Write src/publisher.ts**

```typescript
import type { ClientRequestOptions, PublishParams } from "./types";

interface SDKLike {
  getClient(): { publish(request: PublishParams, options?: ClientRequestOptions): Promise<unknown> };
}

export class ContextPublisher {
  publish(request: PublishParams, sdk: SDKLike, _context: unknown, requestOptions?: ClientRequestOptions): Promise<unknown> {
    return sdk.getClient().publish(request, requestOptions);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/provider.test.ts src/__tests__/publisher.test.ts`

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/provider.ts src/publisher.ts src/__tests__/provider.test.ts src/__tests__/publisher.test.ts
git commit -m "feat: add ContextDataProvider and ContextPublisher"
```

---

## Task 13: Context Class

This is the largest and most complex module. The `Context` class manages experiment assignments, exposure tracking, goal tracking, attribute management, and publish/refresh lifecycle.

**Files:**
- Create: `src/context.ts`
- Create: `src/__tests__/context.test.ts`

- [ ] **Step 1: Write the failing tests**

Write comprehensive tests covering all Context functionality. Due to the size of this module, the tests are extensive. The test should cover:

1. Constructor with immediate data vs promise data
2. `isReady()`, `isFailed()`, `isFinalized()`, `isFinalizing()` state checks
3. `ready()` promise resolution
4. `unit()` / `units()` - setting and validating unit identifiers
5. `attribute()` / `attributes()` - setting user attributes
6. `treatment()` - variant assignment with exposure tracking
7. `peek()` - variant assignment without exposure
8. `track()` - goal tracking
9. `publish()` - flushing pending events
10. `refresh()` - fetching updated experiment data
11. `finalize()` - cleanup and final publish
12. `variableValue()` / `peekVariableValue()` - experiment variable access
13. `override()` / `overrides()` - forced variant assignment
14. `customAssignment()` / `customAssignments()` - custom assignment logic
15. `customFieldValue()` / `customFieldKeys()` - custom field access
16. Auto-publish timeout behavior
17. Refresh interval behavior
18. Error handling and failed state
19. System attributes inclusion

The test file should use the same experiment fixture data from the original test suite to ensure byte-level compatibility. Create the file with the complete test content from the original `context.test.js` adapted to Vitest syntax (replace `jest.fn()` with `vi.fn()`, `jest.spyOn` with `vi.spyOn`, etc.).

Run: `npx vitest run src/__tests__/context.test.ts`

Expected: FAIL - module not found

- [ ] **Step 2: Write src/context.ts**

Port the Context class from the original codebase with strict TypeScript types. The implementation must:

- Import types from `./types` instead of declaring locally
- Import `hashUnit` from `./hashing` instead of `./utils`
- Import `VariantAssigner` from `./assigner`
- Import `AudienceMatcher` from `./matcher`
- Import `insertUniqueSorted` from `./algorithm`
- Import `arrayEqualsShallow`, `isObject`, `isPromise` from `./utils`
- Import `SDK_VERSION` from `./version`
- Use native `setTimeout`/`setInterval`/`clearTimeout`/`clearInterval`
- Use `structuredClone` in `_buildAttributes` if cloning is needed
- Maintain identical API: all public methods have the same signatures
- All private methods prefixed with `_` as in original

The logic must be identical to the original `context.ts` to maintain backward compatibility.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/context.test.ts`

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/context.ts src/__tests__/context.test.ts
git commit -m "feat: add Context class with experiment assignment and lifecycle management"
```

---

## Task 14: SDK Class

**Files:**
- Create: `src/sdk.ts`
- Create: `src/__tests__/sdk.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test, vi } from "vitest";
import { SDK } from "../sdk";
import type { ClientOptions, ContextParams } from "../types";

const defaultOpts: ClientOptions = {
  agent: "test-agent",
  apiKey: "test-api-key",
  application: "test-app",
  endpoint: "https://test.absmartly.io/v1",
  environment: "test",
};

describe("SDK", () => {
  test("creates SDK instance", () => {
    const sdk = new SDK(defaultOpts);
    expect(sdk).toBeInstanceOf(SDK);
  });

  test("getClient returns client", () => {
    const sdk = new SDK(defaultOpts);
    expect(sdk.getClient()).toBeDefined();
  });

  test("get/set event logger", () => {
    const sdk = new SDK(defaultOpts);
    const logger = vi.fn();
    sdk.setEventLogger(logger);
    expect(sdk.getEventLogger()).toBe(logger);
  });

  test("default event logger logs errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test");
    SDK.defaultEventLogger({} as never, "error", error);
    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });

  test("createContext validates unit types", () => {
    const sdk = new SDK(defaultOpts);
    expect(() => sdk.createContext({ units: { session_id: true as unknown as string } })).toThrow(
      "Unit 'session_id' UID is of unsupported type 'boolean'. UID must be one of ['string', 'number']",
    );
  });

  test("createContext validates empty string units", () => {
    const sdk = new SDK(defaultOpts);
    expect(() => sdk.createContext({ units: { session_id: "" } })).toThrow(
      "Unit 'session_id' UID length must be >= 1",
    );
  });

  test("createContext returns Context instance", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ experiments: [] }) }));
    const sdk = new SDK(defaultOpts);
    const context = sdk.createContext({ units: { session_id: "abc" } });
    expect(context).toBeDefined();
    vi.restoreAllMocks();
  });

  test("createContextWith accepts pre-fetched data", () => {
    const sdk = new SDK(defaultOpts);
    const context = sdk.createContextWith({ units: { session_id: "abc" } }, { experiments: [] });
    expect(context).toBeDefined();
    expect(context.isReady()).toBe(true);
  });

  test("get/set context publisher", () => {
    const sdk = new SDK(defaultOpts);
    const publisher = { publish: vi.fn() };
    sdk.setContextPublisher(publisher as never);
    expect(sdk.getContextPublisher()).toBe(publisher);
  });

  test("get/set context data provider", () => {
    const sdk = new SDK(defaultOpts);
    const provider = { getContextData: vi.fn() };
    sdk.setContextDataProvider(provider as never);
    expect(sdk.getContextDataProvider()).toBe(provider);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/sdk.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/sdk.ts**

```typescript
import { Client } from "./client";
import { Context } from "./context";
import { ContextPublisher } from "./publisher";
import { ContextDataProvider } from "./provider";
import type {
  ClientOptions,
  ClientRequestOptions,
  ContextData,
  ContextOptions,
  ContextParams,
  EventLogger,
  EventLoggerData,
  EventName,
  Exposure,
  Goal,
  PublishParams,
  SDKOptions,
} from "./types";

function isLongLivedApp(): boolean {
  return (typeof window !== "undefined" && typeof window.document !== "undefined") ||
    (typeof navigator !== "undefined" && navigator.product === "ReactNative");
}

const CLIENT_OPTION_KEYS = ["application", "agent", "apiKey", "endpoint", "keepalive", "environment", "retries", "timeout"];

export class SDK {
  static defaultEventLogger: EventLogger = (_, eventName, data) => {
    if (eventName === "error") console.error(data);
  };

  private _eventLogger: EventLogger;
  private _publisher: ContextPublisher;
  private _provider: ContextDataProvider;
  private readonly _client: Client;

  constructor(options: ClientOptions & SDKOptions) {
    const clientOptions = Object.assign(
      { agent: "absmartly-javascript-sdk" },
      ...Object.entries(options || {})
        .filter((x) => CLIENT_OPTION_KEYS.indexOf(x[0]) !== -1)
        .map((x) => ({ [x[0]]: x[1] })),
    ) as ClientOptions;

    this._client = (options.client as Client) || new Client(clientOptions);
    this._eventLogger = options.eventLogger || SDK.defaultEventLogger;
    this._publisher = (options.publisher as ContextPublisher) || new ContextPublisher();
    this._provider = (options.provider as ContextDataProvider) || new ContextDataProvider();
  }

  getContextData(requestOptions: ClientRequestOptions): Promise<ContextData> {
    return this._provider.getContextData(this, requestOptions);
  }

  createContext(
    params: ContextParams,
    options?: Partial<ContextOptions>,
    requestOptions?: Partial<ClientRequestOptions>,
  ): Context {
    SDK._validateParams(params);
    const fullOptions = SDK._contextOptions(options);
    const data = this._provider.getContextData(this, requestOptions);
    return new Context(this, fullOptions, params, data);
  }

  createContextWith(
    params: ContextParams,
    data: ContextData | Promise<ContextData>,
    options?: Partial<ContextOptions>,
  ): Context {
    SDK._validateParams(params);
    const fullOptions = SDK._contextOptions(options);
    return new Context(this, fullOptions, params, data);
  }

  setEventLogger(logger: EventLogger): void {
    this._eventLogger = logger;
  }

  getEventLogger(): EventLogger {
    return this._eventLogger;
  }

  setContextPublisher(publisher: ContextPublisher): void {
    this._publisher = publisher;
  }

  getContextPublisher(): ContextPublisher {
    return this._publisher;
  }

  setContextDataProvider(provider: ContextDataProvider): void {
    this._provider = provider;
  }

  getContextDataProvider(): ContextDataProvider {
    return this._provider;
  }

  getClient(): Client {
    return this._client;
  }

  private static _contextOptions(options?: Partial<ContextOptions>): ContextOptions {
    return Object.assign(
      { publishDelay: isLongLivedApp() ? 100 : -1, refreshPeriod: 0 },
      options || {},
    ) as ContextOptions;
  }

  private static _validateParams(params: ContextParams): void {
    for (const [key, value] of Object.entries(params.units)) {
      const type = typeof value;
      if (type !== "string" && type !== "number") {
        throw new Error(`Unit '${key}' UID is of unsupported type '${type}'. UID must be one of ['string', 'number']`);
      }
      if (typeof value === "string" && value.length === 0) {
        throw new Error(`Unit '${key}' UID length must be >= 1`);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/sdk.test.ts`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/sdk.ts src/__tests__/sdk.test.ts
git commit -m "feat: add SDK class with context creation and configuration"
```

---

## Task 15: Config Merge Utility

**Files:**
- Create: `src/config.ts`
- Create: `src/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test, vi } from "vitest";
import { mergeConfig } from "../config";

function mockContext(variableKeys: Record<string, string[]>, variableValues: Record<string, unknown> = {}) {
  return {
    variableKeys: () => variableKeys,
    variableValue: (key: string, defaultValue: unknown) =>
      key in variableValues ? variableValues[key] : defaultValue,
  };
}

describe("mergeConfig", () => {
  test("returns new object, does not mutate original", () => {
    const original = { key: "value" };
    const context = mockContext({});
    const result = mergeConfig(context as never, original);
    expect(result).not.toBe(original);
    expect(result).toEqual({ key: "value" });
  });

  test("creates getter for experiment variable", () => {
    const context = mockContext(
      { "button.color": ["exp_test"] },
      { "button.color": "red" },
    );
    const config = { button: { color: "blue" } };
    const result = mergeConfig(context as never, config);
    expect(result.button.color).toBe("red");
  });

  test("falls back to default when variable not set", () => {
    const context = mockContext({ "button.color": ["exp_test"] });
    const config = { button: { color: "blue" } };
    const result = mergeConfig(context as never, config);
    expect(result.button.color).toBe("blue");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/config.test.ts`

Expected: FAIL - module not found

- [ ] **Step 3: Write src/config.ts**

```typescript
import { isObject } from "./utils";

interface ConfigContext {
  variableKeys(): Record<string, unknown[]>;
  variableValue(key: string, defaultValue: unknown): unknown;
}

export function mergeConfig(context: ConfigContext, previousConfig: Record<string, unknown>): Record<string, unknown> {
  const merged = structuredClone(previousConfig);
  const keys = context.variableKeys();

  for (const [variableKey, experimentName] of Object.entries(keys)) {
    let target: Record<string, unknown> | undefined = merged;
    const frags = variableKey.split(".");

    for (let index = 0; index < frags.length; ++index) {
      const frag = frags[index]!;

      if (target === undefined) break;

      if (`_${frag}_setter` in target) {
        console.error(
          `Config key '${frags.slice(0, index + 1).join(".")}' already set by experiment '${target[`_${frag}_setter`]}'.`,
        );
        target = undefined;
        break;
      }

      if (frag in target) {
        if (index < frags.length - 1) {
          if (!isObject(target[frag])) {
            console.warn(
              `Config key '${variableKey}' for experiment '${experimentName}' is overriding non-object value at '${frags.slice(0, index + 1).join(".")}' with an object.`,
            );
            target[frag] = {};
            target = target[frag] as Record<string, unknown>;
          } else {
            target = target[frag] as Record<string, unknown>;
          }
        }
      }

      if (index === frags.length - 1) {
        const defaultValue = target[frag];

        Object.defineProperty(target, `_${frag}_setter`, { value: experimentName, writable: false });
        Object.defineProperty(target, frag, {
          get: () => context.variableValue(variableKey, defaultValue),
        });
      }
    }
  }

  return merged;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/config.test.ts`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/__tests__/config.test.ts
git commit -m "feat: add mergeConfig utility for experiment variable injection"
```

---

## Task 16: Public API & Index

**Files:**
- Create: `src/index.ts`
- Remove: `src/__tests__/placeholder.test.ts`

- [ ] **Step 1: Write src/index.ts**

```typescript
export { SDK } from "./sdk";
export { Context } from "./context";
export { ContextDataProvider } from "./provider";
export { ContextPublisher } from "./publisher";
export { mergeConfig } from "./config";

export type {
  ApplicationObject,
  Attribute,
  Assignment,
  ClientOptions,
  ClientRequestOptions,
  ContextData,
  ContextOptions,
  ContextParams,
  CustomFieldValue,
  CustomFieldValueType,
  EventLogger,
  EventLoggerData,
  EventName,
  Experiment,
  ExperimentData,
  Exposure,
  Goal,
  JSONValue,
  NormalizedClientOptions,
  PublishParams,
  SDKOptions,
  Unit,
  Units,
} from "./types";
```

- [ ] **Step 2: Remove placeholder test**

```bash
rm -f src/__tests__/placeholder.test.ts
```

- [ ] **Step 3: Verify full build**

```bash
npx tsc --noEmit && npx tsup
```

Expected: Build succeeds, `dist/` contains all output files with correct exports

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run
```

Expected: All tests across all modules pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add public API exports and verify complete build"
```

---

## Task 17: Full Integration & Cleanup

**Files:**
- Modify: `package.json` (if needed)
- Remove: any leftover old files

- [ ] **Step 1: Clean up any remaining old files**

```bash
rm -rf js/ lib/ es/ dist/ types/
```

Verify no old config files remain.

- [ ] **Step 2: Run full build pipeline**

```bash
npm run build
```

Expected: `dist/` contains:
- `index.js` (ESM)
- `index.cjs` (CommonJS)
- `index.global.js` (browser IIFE)
- `index.d.ts` (TypeScript declarations)
- `index.d.cts` (CTS declarations)

- [ ] **Step 3: Run full test suite with coverage**

```bash
npm run test:coverage
```

Expected: All tests pass with high coverage

- [ ] **Step 4: Verify TypeScript strict mode passes**

```bash
npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final cleanup and verify full build pipeline"
```
