import { makeClusterId } from "./ids.js";
import { rankOriginCandidates } from "./originRank.js";
import type {
  CauseCluster,
  DiagnosticCategory,
  DiagnosticSeverity,
  NormalizedDiagnostic,
  ProjectInfo,
} from "./types.js";

const SEVERITY_WEIGHT: Record<DiagnosticSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

export function clusterCauseRibbons(
  diagnostics: NormalizedDiagnostic[],
  project?: ProjectInfo,
  maxFiles = 2000,
): CauseCluster[] {
  const groups = new Map<string, NormalizedDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const key = keyForDiagnostic(diagnostic);
    const items = groups.get(key) ?? [];
    items.push(diagnostic);
    groups.set(key, items);
  }

  const clusters: CauseCluster[] = [];

  for (const [key, grouped] of groups.entries()) {
    grouped.sort((a, b) => (a.file ?? "").localeCompare(b.file ?? "") || (a.line ?? 0) - (b.line ?? 0));

    const anchor = grouped.find((item) => item.severity === "error") ?? grouped[0];
    const severity = grouped.reduce<DiagnosticSeverity>((highest, current) =>
      SEVERITY_WEIGHT[current.severity] > SEVERITY_WEIGHT[highest] ? current.severity : highest,
    "info");

    const category = anchor?.category ?? "unknown";
    const confidence = confidenceFor(grouped, category, key);
    const filesCount = new Set(grouped.map((item) => item.file).filter(Boolean)).size;

    const cluster: CauseCluster = {
      id: makeClusterId(key),
      title: titleFor(anchor, key),
      category,
      severity,
      diagnostics: grouped,
      originCandidates: project
        ? rankOriginCandidates(
            { diagnostics: grouped, ...(anchor ? { anchor } : {}), category },
            project.root,
            project,
            { maxFiles },
          )
        : [],
      confidence,
      suggestedFirstAction: actionFor(category),
      explanation:
        grouped.length > 1
          ? "This cause ribbon is likely upstream. Several diagnostics may be downstream effects."
          : "This cause ribbon has one diagnostic and is a likely starting point.",
      evidence: evidenceFor(anchor, grouped.length, filesCount, project),
    };
    if (anchor) {
      cluster.anchor = anchor;
    }

    clusters.push(cluster);
  }

  return clusters.sort((a, b) => b.confidence - a.confidence || b.diagnostics.length - a.diagnostics.length);
}

function keyForDiagnostic(diagnostic: NormalizedDiagnostic): string {
  if (diagnostic.source === "typescript" && diagnostic.category === "missing-module") {
    return `ts:missing-module:${diagnostic.symbol ?? diagnostic.code ?? diagnostic.message}`;
  }
  if (diagnostic.source === "typescript" && diagnostic.code === "TS2339") {
    if (diagnostic.symbol && diagnostic.typeName) {
      return `ts:missing-property:${diagnostic.typeName}.${diagnostic.symbol}`;
    }
    return `ts:missing-property:${diagnostic.symbol ?? diagnostic.file ?? "unknown"}`;
  }
  if (diagnostic.source === "typescript" && diagnostic.code === "TS2304") {
    return `ts:missing-symbol:${diagnostic.symbol ?? diagnostic.message}`;
  }
  if (diagnostic.source === "typescript" && diagnostic.category === "syntax") {
    return `ts:syntax:${diagnostic.file ?? "unknown"}:${Math.floor((diagnostic.line ?? 0) / 20)}`;
  }
  if (diagnostic.source === "typescript" && diagnostic.category === "type") {
    return `ts:type:${diagnostic.code ?? "unknown"}:${diagnostic.symbol ?? diagnostic.file ?? "unknown"}`;
  }
  if (diagnostic.source === "eslint") {
    return diagnostic.ruleId
      ? `eslint:${diagnostic.ruleId}`
      : `eslint:unknown:${diagnostic.file ?? "unknown"}`;
  }
  if (diagnostic.source === "npm-audit") {
    return `audit:${diagnostic.packageName ?? "unknown"}`;
  }
  if (diagnostic.source === "pipe" || diagnostic.source === "unknown") {
    return `${diagnostic.source}:${diagnostic.category}:${diagnostic.file ?? "unknown"}`;
  }
  return `${diagnostic.source}:${diagnostic.category}:${diagnostic.code ?? diagnostic.ruleId ?? diagnostic.file ?? "unknown"}`;
}

function confidenceFor(items: NormalizedDiagnostic[], category: DiagnosticCategory, key: string): number {
  if (items.length === 1) {
    return 0.45;
  }
  if (key.startsWith("ts:missing-property") || key.startsWith("ts:missing-symbol") || key.startsWith("ts:missing-module")) {
    return 0.9;
  }
  if (key.startsWith("eslint:")) {
    return 0.85;
  }
  if (key.startsWith("audit:")) {
    return 0.9;
  }
  if (key.startsWith("ts:syntax:")) {
    return 0.75;
  }
  if (category !== "unknown") {
    return 0.55;
  }
  return 0.45;
}

function titleFor(anchor: NormalizedDiagnostic | undefined, key: string): string {
  if (!anchor) {
    return "Unknown cause ribbon";
  }
  if (key.startsWith("ts:missing-module")) {
    return `Missing module: ${anchor.symbol ?? anchor.message}`;
  }
  if (key.startsWith("ts:missing-property")) {
    const suffix = anchor.typeName && anchor.symbol ? `${anchor.typeName}.${anchor.symbol}` : (anchor.symbol ?? anchor.message);
    return `Missing property: ${suffix}`;
  }
  if (key.startsWith("ts:missing-symbol")) {
    return `Missing symbol: ${anchor.symbol ?? anchor.message}`;
  }
  if (key.startsWith("ts:type")) {
    return `Type mismatch: ${anchor.code ?? "TypeScript"}`;
  }
  if (key.startsWith("eslint:")) {
    return `Lint rule: ${anchor.ruleId ?? "unknown"}`;
  }
  if (key.startsWith("audit:")) {
    return `Vulnerable dependency: ${anchor.packageName ?? "unknown"}`;
  }
  if (key.startsWith("ts:syntax")) {
    return `Syntax issue near ${(anchor.file ?? "unknown file")}:${anchor.line ?? "?"}`;
  }
  return `Cause ribbon: ${anchor.category}`;
}

function actionFor(category: DiagnosticCategory): string {
  switch (category) {
    case "missing-module":
      return "Check the import path, path alias, and whether the file/package exists.";
    case "missing-symbol":
      return "Check whether the symbol was renamed, moved, or not imported.";
    case "syntax":
      return "Fix the earliest syntax error first, then rerun Ribbon.";
    case "lint":
      return "Review this ESLint rule cluster; apply autofix only if the change is obvious.";
    case "security":
      return "Inspect the dependency path and update the vulnerable package if safe.";
    case "type":
      return "Inspect the expected type at the anchor diagnostic and the value being passed.";
    default:
      return "Inspect the anchor diagnostic and rerun Ribbon after one focused fix.";
  }
}

function evidenceFor(
  anchor: NormalizedDiagnostic | undefined,
  count: number,
  filesCount: number,
  project?: ProjectInfo,
): string[] {
  const evidence: string[] = [];
  if (anchor?.code) {
    evidence.push(anchor.code);
  }
  if (anchor?.ruleId) {
    evidence.push(anchor.ruleId);
  }
  evidence.push(`${count} diagnostics`);
  evidence.push(`${filesCount} files affected`);
  if (anchor?.symbol) {
    evidence.push(`repeated symbol '${anchor.symbol}'`);
  }
  if (project?.git?.isRepo && anchor?.file && project.git.changedFiles.includes(anchor.file)) {
    evidence.push("anchor in changed files");
  }
  return evidence;
}
