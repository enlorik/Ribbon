import nodePath from "node:path";
import { readJsoncFile } from "../utils/fs.js";
import { normalizeSlashes } from "../utils/paths.js";

export interface TsconfigPathsData {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

/**
 * Read compilerOptions.baseUrl and compilerOptions.paths from a tsconfig.json.
 * Follows a single-level `extends` chain so inherited options are included.
 * Returns undefined if the file is missing, invalid, or has no usable paths config.
 */
export function readTsconfigPaths(tsconfigPath: string): TsconfigPathsData | undefined {
  return readTsconfigPathsAt(nodePath.resolve(tsconfigPath), 0);
}

function extractOptions(
  data: Record<string, unknown>,
): { baseUrl: string | undefined; paths: Record<string, string[]> | undefined } {
  const compilerOptions = data["compilerOptions"] as Record<string, unknown> | undefined;
  let baseUrl: string | undefined;
  let paths: Record<string, string[]> | undefined;

  if (compilerOptions && typeof compilerOptions === "object") {
    if (typeof compilerOptions["baseUrl"] === "string") {
      baseUrl = compilerOptions["baseUrl"];
    }
    const rawPaths = compilerOptions["paths"];
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
  }
  return { baseUrl, paths };
}

function readTsconfigPathsAt(absPath: string, depth: number): TsconfigPathsData | undefined {
  if (depth > 5) return undefined;

  const data = readJsoncFile<Record<string, unknown>>(absPath);
  if (!data || typeof data !== "object") return undefined;

  let { baseUrl, paths } = extractOptions(data);

  // Follow extends to pick up inherited compilerOptions
  const extendsValue = data["extends"];
  if (typeof extendsValue === "string" && (baseUrl === undefined || paths === undefined)) {
    const extFile = extendsValue.endsWith(".json") ? extendsValue : `${extendsValue}.json`;
    // Only follow relative or absolute extends (skip node_modules references)
    if (extFile.startsWith(".") || nodePath.isAbsolute(extFile)) {
      const parentPath = nodePath.resolve(nodePath.dirname(absPath), extFile);
      const parent = readTsconfigPathsAt(parentPath, depth + 1);
      if (parent) {
        if (baseUrl === undefined) baseUrl = parent.baseUrl;
        if (paths === undefined) paths = parent.paths;
      }
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

  // Sort patterns by specificity: exact matches first, then wildcards by
  // prefix length descending (same rule TypeScript uses for paths resolution).
  const sortedEntries = Object.entries(paths).sort(([a], [b]) => {
    const specificity = (p: string) => (p.endsWith("/*") ? p.length - 1 : p.length);
    return specificity(b) - specificity(a);
  });

  const results: string[] = [];

  for (const [pattern, targets] of sortedEntries) {
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
