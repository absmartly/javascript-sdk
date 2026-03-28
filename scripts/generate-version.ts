import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
writeFileSync("src/version.ts", `export const SDK_VERSION = "${pkg.version}";\n`);
