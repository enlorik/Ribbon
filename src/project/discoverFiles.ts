import { readdirSync } from "node:fs";
import path from "node:path";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  "out",
  ".turbo",
  ".cache",
]);

const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".json",
]);

export function discoverProjectFiles(root: string, maxFiles: number): string[] {
  const found: string[] = [];
  const queue: string[] = [root];

  while (queue.length > 0 && found.length < maxFiles) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (found.length >= maxFiles) {
        break;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name);
      if (INCLUDED_EXTENSIONS.has(ext)) {
        found.push(fullPath);
      }
    }
  }

  return found;
}
