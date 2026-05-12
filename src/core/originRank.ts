import path from "node:path";
import { readTextFile } from "../utils/fs.js";
import { normalizeSlashes } from "../utils/paths.js";
import { discoverProjectFiles } from "../project/discoverFiles.js";
import type { CauseCluster, OriginCandidate, ProjectInfo } from "./types.js";

export interface RankOptions {
  maxFiles: number;
}

export function rankOriginCandidates(
  cluster: { diagnostics: CauseCluster["diagnostics"]; anchor?: CauseCluster["anchor"]; category: CauseCluster["category"] },
  projectRoot: string,
  projectInfo?: ProjectInfo,
  options: RankOptions = { maxFiles: 2000 },
): OriginCandidate[] {
  const scores = new Map<string, { score: number; reasons: Set<string> }>();
  const changed = new Set(projectInfo?.git?.changedFiles ?? []);
  const files = discoverProjectFiles(projectRoot, options.maxFiles);

  const add = (file: string, points: number, reason: string): void => {
    const normalized = normalizeSlashes(path.relative(projectRoot, file) || file);
    const entry = scores.get(normalized) ?? { score: 0, reasons: new Set<string>() };
    entry.score += points;
    entry.reasons.add(reason);
    if (/\/(dist|build)\//.test(normalized) || normalized.endsWith(".min.js")) {
      entry.score -= 3;
      entry.reasons.add("generated file penalty");
    }
    scores.set(normalized, entry);
  };

  for (const diagnostic of cluster.diagnostics) {
    if (diagnostic.file) {
      add(path.resolve(projectRoot, diagnostic.file), 20, "direct diagnostic location");
    }
  }

  if (cluster.anchor?.file) {
    add(path.resolve(projectRoot, cluster.anchor.file), 12, "anchor file");
  }

  for (const changedFile of changed) {
    add(path.resolve(projectRoot, changedFile), 10, "git changed file");
  }

  if (cluster.category === "missing-module") {
    if (projectInfo?.tsconfigPath) {
      add(projectInfo.tsconfigPath, 12, "path alias configuration candidate");
    }
    if (projectInfo?.packageJsonPath) {
      add(projectInfo.packageJsonPath, 5, "dependency/import configuration candidate");
    }
  }

  if (cluster.category === "security" && projectInfo?.packageJsonPath) {
    add(projectInfo.packageJsonPath, 5, "dependency manifest");
    if (projectInfo.lockfile) {
      add(path.join(projectRoot, projectInfo.lockfile), 5, "lockfile");
    }
  }

  const symbol = cluster.anchor?.symbol;
  const typeName = cluster.anchor?.typeName;

  for (const file of files) {
    const text = readTextFile(file);
    if (!text) {
      continue;
    }

    if (typeName) {
      const typePattern = new RegExp(`\\b(interface|type|class)\\s+${escapeRegExp(typeName)}\\b`);
      if (typePattern.test(text)) {
        add(file, 15, `contains type ${typeName}`);
      }
      if (symbol && text.includes(symbol)) {
        add(file, 5, `mentions symbol ${symbol}`);
      }
    }

    if (symbol && !typeName) {
      const symbolPattern = new RegExp(
        `\\b(export\\s+)?(function|const|let|var|class|interface|type)\\s+${escapeRegExp(symbol)}\\b`,
      );
      if (symbolPattern.test(text)) {
        add(file, 15, `defines symbol ${symbol}`);
      }
      if (text.includes(symbol)) {
        add(file, 5, `mentions symbol ${symbol}`);
      }
    }

    if (cluster.category === "missing-module" && symbol?.startsWith("@/")) {
      const target = symbol.replace(/^@\//, "");
      if (normalizeSlashes(file).includes(target)) {
        add(file, 8, "path resembles missing module import");
      }
    }
  }

  return [...scores.entries()]
    .map(([file, value]) => ({
      file,
      score: value.score,
      reasons: [...value.reasons],
    }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, 5);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
