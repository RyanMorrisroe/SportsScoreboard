import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({ configFile: join(root, "vite.config.js") });
copyFileSync(join(root, "LICENSE"), join(root, "dist", "LICENSE"));
