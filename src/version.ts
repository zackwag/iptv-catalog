import { readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as {
  version: string;
};
export const APP_VERSION: string = pkg.version;
