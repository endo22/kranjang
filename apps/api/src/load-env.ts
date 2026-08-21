import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cwdEnvPath = resolve(process.cwd(), ".env");
const sourceEnvPath = fileURLToPath(new URL("../.env", import.meta.url));

process.loadEnvFile?.(existsSync(cwdEnvPath) ? cwdEnvPath : sourceEnvPath);
