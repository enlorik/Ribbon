import picocolors from "picocolors";
import type { CheckResult, CauseCluster, ToolRunResult } from "./types.js";

export interface FormatOptions {
  color: boolean;
  verbose: boolean;
}

export function formatCheckOutput(result: CheckResult, options: FormatOptions): string {
  const c: Pick<typeof picocolors, "bold" | "cyan" | "dim" | "yellow"> = options.color
    ? picocolors
    : {
        bold: (v) => String(v),
        cyan: (v) => String(v),
        dim: (v) => String(v),
        yellow: (v) => String(v),
      };

  const actionableClusters = result.clusters.filter(
    (cluster) => cluster.severity === "error" || cluster.severity === "warning",
  );
  const infoClusters = result.clusters.filter((cluster) => cluster.severity === "info");

  const lines: string[] = [];

  if (actionableClusters.length === 0) {
    lines.push("Ribbon found no actionable problems.");

    if (options.verbose && infoClusters.length > 0) {
      lines.push("");
      lines.push("Notes:");
      for (const cluster of infoClusters) {
        lines.push(`  ${cluster.title}`);
      }
    }

    const skipped = result.toolRuns.filter((run) => run.skipped);
    if (skipped.length > 0 && !options.verbose) {
      lines.push(`Skipped: ${skipped.map((run) => `${run.tool} ${run.skipReason ?? "skipped"}`).join("; ")}`);
    }

    return lines.join("\n").trimEnd();
  }

  const actionableDiagnosticsCount = actionableClusters.reduce(
    (sum, cluster) => sum + cluster.diagnostics.length,
    0,
  );
  lines.push(c.bold(`Ribbon found ${actionableClusters.length} cause ribbons tying ${actionableDiagnosticsCount} problems`));
  lines.push("");

  actionableClusters.forEach((cluster, index) => {
    lines.push(formatCluster(cluster, index + 1, c));
    lines.push("");
  });

  if (options.verbose && infoClusters.length > 0) {
    lines.push("Notes:");
    for (const cluster of infoClusters) {
      lines.push(`  ${cluster.title}`);
    }
    lines.push("");
  }

  const skipped = result.toolRuns.filter((run) => run.skipped);
  if (skipped.length > 0) {
    if (options.verbose) {
      lines.push("Skipped tools:");
      for (const run of skipped) {
        lines.push(`  - ${run.tool}: ${run.skipReason ?? "skipped"}`);
      }
    } else {
      lines.push(`Skipped: ${skipped.map((run) => `${run.tool} ${run.skipReason ?? "skipped"}`).join("; ")}`);
    }
  }

  return lines.join("\n").trimEnd();
}

function formatCluster(cluster: CauseCluster, index: number, c: Pick<typeof picocolors, "bold" | "cyan" | "dim" | "yellow">): string {
  const origin = cluster.originCandidates[0]?.file ?? cluster.anchor?.file ?? "unknown";
  const evidence = cluster.evidence.join("; ");
  return [
    `${index}. ${c.cyan(cluster.title)}`,
    `   severity: ${cluster.severity}`,
    `   may explain: ${cluster.diagnostics.length} ${cluster.anchor?.source ?? "tool"} diagnostics`,
    `   origin candidate: ${origin}`,
    `   confidence: ${Math.round(cluster.confidence * 100)}%`,
    `   evidence: ${c.dim(evidence)}`,
    `   try first: ${c.yellow(cluster.suggestedFirstAction)}`,
  ].join("\n");
}

export function formatDoctorOutput(lines: string[]): string {
  return ["Ribbon doctor", "", ...lines].join("\n");
}

export function summarizeToolFailure(run: ToolRunResult): string {
  return `${run.tool} command ${run.command} ${run.args.join(" ")} failed to start: ${run.skipReason ?? run.stderr}`;
}
