import { readJsonFile } from "../utils/fs.js";
import { normalizeSlashes } from "../utils/paths.js";

export interface TsconfigPathsData {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

/**
 * Read compilerOptions.baseUrl and compilerOptions.paths from a tsconfig.json.
 * Returns undefined if the file is missing, invalid, or has no usable paths config.
 */
export function readTsconfigPaths(tsconfigPath: string): TsconfigPathsData | undefined {
  const data = readJsonFile<Record<string, unknown>>(tsconfigPath);
  if (!data || typeof data !== "object") return undefined;

  const compilerOptions = data["compilerOptions"] as Record<string, unknown> | undefined;
  if (!compilerOptions || typeof compilerOptions !== "object") return undefined;

  const baseUrl =
    typeof compilerOptions["baseUrl"] === "string" ? compilerOptions["baseUrl"] : undefined;

  const rawPaths = compilerOptions["paths"];
  let paths: Record<string, string[]> | undefined;
  if (rawPaths !== null && typeof rawPaths === "object" && !Array.isArray(rawPaths)) {
    const collected: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(rawPaths as Record<string, unknown>)) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        collected[key] = value as string[];
      }
    }
    if (Object.keys(collected).length > 0) {
      paths = collected;
    }
  }

  if (!baseUrl && !paths) return undefined;
  const result: TsconfigPathsData = {};
  if (baseUrl !== undefined) result.baseUrl = baseUrl;
  if (paths !== undefined) result.paths = paths;
  return result;
}

/**
 * Given a module symbol (e.g. "@/lib/auth") and tsconfig paths data,
 * return all possible base paths without extensions (e.g. ["src/lib/auth"]).
 */
export function resolveTsconfigAlias(symbol: string, pathsData: TsconfigPathsData): string[] {
  const { paths } = pathsData;
  if (!paths) return [];

  const results: string[] = [];

  for (const [pattern, targets] of Object.entries(paths)) {
    const suffix = matchGlobPattern(symbol, pattern);
    if (suffix === undefined) continue;

    for (const target of targets) {
      if (target.endsWith("/*") && suffix !== "") {
        const targetBase = target.slice(0, -2);
        results.push(normalizeSlashes(`${targetBase}/${suffix}`));
      } else if (!target.includes("*") && suffix === "") {
        results.push(normalizeSlashes(target));
      }
    }
  }

  return results;
}

/**
 * If `symbol` matches `pattern` (which may end with `/*`), return the wildcard suffix.
 * Returns an empty string for an exact match, or undefined if no match.
 */
function matchGlobPattern(symbol: string, pattern: string): string | undefined {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1); // e.g. "@/" or "@lib/"
    if (symbol.startsWith(prefix)) {
      return symbol.slice(prefix.length);
    }
    return undefined;
  }
  return symbol === pattern ? "" : undefined;
}
