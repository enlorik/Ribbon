import path from "node:path";
import { normalizeSlashes } from "../utils/paths.js";
import type { TsconfigPathsData } from "./tsconfigPaths.js";
import { resolveTsconfigAlias } from "./tsconfigPaths.js";

export interface ImportGraph {
  outgoing: Map<string, Set<string>>;
}

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

const FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_RE = /\bimport\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function buildImportGraph(
  files: ReadonlyArray<{ relativePath: string; text: string }>,
  tsconfigPaths?: TsconfigPathsData,
): ImportGraph {
  const fileSet = new Set(files.map((f) => f.relativePath));
  const outgoing = new Map<string, Set<string>>();

  for (const { relativePath, text } of files) {
    const edges = new Set<string>();
    const dir = normalizeSlashes(path.dirname(relativePath));

    for (const specifier of extractSpecifiers(stripComments(text))) {
      const resolved = resolveSpecifier(specifier, dir, fileSet, tsconfigPaths);
      if (resolved) {
        edges.add(resolved);
      }
    }

    outgoing.set(relativePath, edges);
  }

  return { outgoing };
}

export function isReachable(
  graph: ImportGraph,
  fromFile: string,
  targetFile: string,
): boolean {
  if (fromFile === targetFile) return true;

  const visited = new Set<string>();
  const queue: string[] = [fromFile];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    for (const neighbor of graph.outgoing.get(file) ?? []) {
      if (neighbor === targetFile) return true;
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return false;
}

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, "");
}

function extractSpecifiers(text: string): string[] {
  const specifiers: string[] = [];
  const seen = new Set<string>();

  function collect(re: RegExp): void {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[1]!;
      if (!seen.has(s)) {
        seen.add(s);
        specifiers.push(s);
      }
    }
  }

  collect(FROM_RE);
  collect(SIDE_EFFECT_RE);
  collect(REQUIRE_RE);

  return specifiers;
}

function resolveSpecifier(
  specifier: string,
  fromDir: string,
  fileSet: Set<string>,
  tsconfigPaths?: TsconfigPathsData,
): string | undefined {
  if (specifier.startsWith("node:") || specifier.includes("://") || specifier.includes("${")) {
    return undefined;
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const full = normalizeSlashes(path.join(fromDir, specifier));
    // Direct hit (e.g. .ts imported as .ts)
    if (fileSet.has(full)) return full;
    // TS ESM-style: `./foo.js` and `./foo.jsx` resolve to their TS equivalents
    const stripped = full.replace(/\.(m|c)?jsx?$/, "");
    return resolveWithExtensions(stripped, fileSet);
  }

  if (tsconfigPaths) {
    const aliases = resolveTsconfigAlias(specifier, tsconfigPaths);
    for (const alias of aliases) {
      const base = tsconfigPaths.baseUrl
        ? normalizeSlashes(path.join(tsconfigPaths.baseUrl, alias))
        : normalizeSlashes(path.normalize(alias));
      const resolved = resolveWithExtensions(base, fileSet);
      if (resolved) return resolved;
    }

    // baseUrl fallback: bare specifier resolved relative to baseUrl directory
    if (tsconfigPaths.baseUrl) {
      const base = normalizeSlashes(path.join(tsconfigPaths.baseUrl, specifier));
      return resolveWithExtensions(base, fileSet);
    }
  }

  return undefined;
}

function resolveWithExtensions(base: string, fileSet: Set<string>): string | undefined {
  if (fileSet.has(base)) return base;

  for (const ext of EXTENSIONS) {
    const c = `${base}${ext}`;
    if (fileSet.has(c)) return c;
  }

  for (const ext of EXTENSIONS) {
    const c = `${base}/index${ext}`;
    if (fileSet.has(c)) return c;
  }

  return undefined;
}
