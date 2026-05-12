import { existsSync, readFileSync } from "node:fs";

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function readTextFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

export function readJsonFile<T>(path: string): T | undefined {
  const text = readTextFile(path);
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
