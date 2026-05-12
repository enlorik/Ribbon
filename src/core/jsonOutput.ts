import type { CheckResult, ToolRunResult } from "./types.js";

export function toJsonOutput(result: CheckResult, verbose: boolean): string {
  const toolRuns = result.toolRuns.map((run) => summarizeToolRun(run, verbose));
  return JSON.stringify(
    {
      project: result.project,
      diagnostics: result.diagnostics,
      clusters: result.clusters,
      toolRuns,
    },
    null,
    2,
  );
}

function summarizeToolRun(run: ToolRunResult, verbose: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    tool: run.tool,
    command: run.command,
    args: run.args,
    exitCode: run.exitCode,
    skipped: run.skipped ?? false,
    skipReason: run.skipReason,
  };

  if (verbose) {
    base.stdout = run.stdout;
    base.stderr = run.stderr;
    base.all = run.all;
  }

  return base;
}
