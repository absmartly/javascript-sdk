const fs = require("fs");
const path = require("path");

const pkg = require(path.resolve(__dirname, "../package.json"));
const versionFile = path.resolve(__dirname, "../src/version.ts");

fs.writeFileSync(versionFile, `export const SDK_VERSION = "${pkg.version}";\n`);
