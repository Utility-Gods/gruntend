import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../dist/", import.meta.url);

await rewrite(root);

async function rewrite(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = fileURLToPath(new URL(entry.name, directory));

    if (entry.isDirectory()) {
      await rewrite(new URL(`${entry.name}/`, directory));
      continue;
    }

    if (!entry.name.endsWith(".d.ts")) continue;

    const source = await readFile(path, "utf8");
    const next = source.replace(/(from\s+["']\.[^"']+)\.ts(["'])/g, "$1.js$2");

    if (next !== source) {
      await writeFile(path, next);
    }
  }
}
