import path from "node:path";

export function resolveRoot(root?: string): string {
  return path.resolve(root ?? process.cwd());
}

export function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}
