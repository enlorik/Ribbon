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

// Strip JSONC comments and trailing commas using a state machine that respects
// string literal boundaries so that URLs or text inside strings are not cut.
function stripJsonc(text: string): string {
  let result = "";
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i]!;

    if (ch === '"') {
      result += ch;
      i++;
      while (i < len) {
        const sc = text[i]!;
        if (sc === "\\") {
          result += sc;
          i++;
          if (i < len) { result += text[i]!; i++; }
        } else if (sc === '"') {
          result += sc;
          i++;
          break;
        } else {
          result += sc;
          i++;
        }
      }
    } else if (ch === "/" && i + 1 < len) {
      if (text[i + 1] === "/") {
        while (i < len && text[i] !== "\n") i++;
      } else if (text[i + 1] === "*") {
        i += 2;
        while (i < len) {
          if (text[i] === "*" && i + 1 < len && text[i + 1] === "/") { i += 2; break; }
          i++;
        }
      } else {
        result += ch; i++;
      }
    } else {
      result += ch; i++;
    }
  }

  return result.replace(/,(\s*[}\]])/g, "$1");
}

export function readJsoncFile<T>(path: string): T | undefined {
  const text = readTextFile(path);
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(stripJsonc(text)) as T;
  } catch {
    return undefined;
  }
}
