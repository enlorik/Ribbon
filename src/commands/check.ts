import path from "node:path";
import { clusterCauseRibbons } from "../core/cluster.js";
import { formatCheckOutput, summarizeToolFailure } from "../core/formatOutput.js";
import { toJsonOutput } from "../core/jsonOutput.js";
import type { CheckResult, NormalizedDiagnostic, ToolRunResult } from "../core/types.js";
import { createDemoDiagnostics } from "../demo/demoDiagnostics.js";
import { parseEslint } from "../parsers/parseEslint.js";
import { parseNpmAudit } from "../parsers/parseNpmAudit.js";
import { parseTsc } from "../parsers/parseTsc.js";
import { detectProject } from "../project/detectProject.js";
import { runLocalTool, runPackageManagerCommand } from "../project/runTools.js";
import { stripAnsi } from "../utils/text.js";

export interface CheckOptions {
  root?: string;
  json?: boolean;
  demo?: boolean;
  ts?: boolean;
  eslint?: boolean;
  audit?: boolean;
  maxFiles?: string;
  noColor?: boolean;
  verbose?: boolean;
}

export async function runCheck(options: CheckOptions): Promise<number> {
  try {
    const project = await detectProject(options.root);

    let diagnostics: NormalizedDiagnostic[] = [];
    const toolRuns: ToolRunResult[] = [];

    if (options.demo) {
      diagnostics = createDemoDiagnostics(Boolean(options.audit));
    } else {
      const enabled = resolveEnabledTools(options, project.hasTsconfig, project.hasEslintConfig);
      const runResults = await collectToolRuns(enabled, project);
      toolRuns.push(...runResults);

      for (const run of runResults) {
        const combined = stripAnsi(run.all || `${run.stdout}\n${run.stderr}`);
        if (run.tool === "typescript" && !run.skipped) {
          diagnostics.push(...parseTsc(combined).map((item) => ({ ...item, toolCommand: `${run.command} ${run.args.join(" ")}` })));
        } else if (run.tool === "eslint" && !run.skipped) {
          const parsed = parseEslint(combined);
          diagnostics.push(...parsed.map((item) => ({ ...item, toolCommand: `${run.command} ${run.args.join(" ")}` })));
          if (parsed.length === 0 && combined.trim() && options.verbose) {
            diagnostics.push({
              id: `eslint-config-${diagnostics.length}`,
              source: "eslint",
              severity: "warning",
              category: "config",
              message: "ESLint output was not JSON; diagnostics may be incomplete.",
              raw: combined,
              toolCommand: `${run.command} ${run.args.join(" ")}`,
            });
          }
        } else if (run.tool === "npm-audit" && !run.skipped) {
          diagnostics.push(...parseNpmAudit(combined).map((item) => ({ ...item, toolCommand: `${run.command} ${run.args.join(" ")}` })));
        }
      }

      if (options.verbose) {
        for (const run of runResults) {
          if (run.skipped) {
            diagnostics.push({
              id: `skip-${run.tool}-${diagnostics.length}`,
              source: run.tool,
              severity: "info",
              category: "config",
              message: summarizeToolFailure(run),
              raw: run.skipReason ?? "skipped",
            });
          }
        }
      }
    }

    const maxFiles = Number(options.maxFiles ?? "2000");
    const clusters = clusterCauseRibbons(diagnostics, project, Number.isFinite(maxFiles) ? maxFiles : 2000);
    const result: CheckResult = { project, diagnostics, clusters, toolRuns };

    const canColor = !options.noColor && Boolean(process.stdout.isTTY);
    if (options.json) {
      process.stdout.write(`${toJsonOutput(result, Boolean(options.verbose))}\n`);
    } else {
      process.stdout.write(`${formatCheckOutput(result, { color: canColor, verbose: Boolean(options.verbose) })}\n`);
    }

    if (diagnostics.length > 0) {
      return 1;
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Ribbon check could not complete: ${message}\n`);
    return 2;
  }
}

async function collectToolRuns(
  enabled: { ts: boolean; eslint: boolean; audit: boolean },
  project: Awaited<ReturnType<typeof detectProject>>,
): Promise<ToolRunResult[]> {
  const runs: ToolRunResult[] = [];

  if (enabled.ts) {
    runs.push(await runLocalTool(project, "typescript", "tsc", ["--noEmit", "--pretty", "false"]));
  } else {
    runs.push(skippedRun("typescript", "TypeScript check disabled or tsconfig.json not found."));
  }

  if (enabled.eslint) {
    runs.push(await runLocalTool(project, "eslint", "eslint", [".", "--format", "json"]));
  } else {
    runs.push(skippedRun("eslint", "ESLint check disabled or ESLint config not found."));
  }

  if (enabled.audit) {
    if (project.packageManager === "npm" && project.lockfile === "package-lock.json") {
    runs.push(await runPackageManagerCommand(project, "npm-audit", ["audit", "--json"]));
    } else {
      runs.push(skippedRun("npm-audit", "npm audit is only supported for npm with package-lock.json in v1."));
    }
  }

  return runs;
}

function resolveEnabledTools(
  options: CheckOptions,
  hasTsconfig: boolean,
  hasEslintConfig: boolean,
): { ts: boolean; eslint: boolean; audit: boolean } {
  const tsFlag = options.ts;       // true = --ts, false = --no-ts, undefined = not set
  const eslintFlag = options.eslint; // true = --eslint, false = --no-eslint, undefined = not set

  let ts: boolean;
  let eslint: boolean;

  if (tsFlag === true && eslintFlag !== true) {
    // --ts without --eslint: run only TypeScript
    ts = true;
    eslint = false;
  } else if (eslintFlag === true && tsFlag !== true) {
    // --eslint without --ts: run only ESLint
    ts = false;
    eslint = true;
  } else {
    // default: respect explicit disables, otherwise follow project detection
    ts = tsFlag === false ? false : hasTsconfig;
    eslint = eslintFlag === false ? false : hasEslintConfig;
  }

  return {
    ts,
    eslint,
    audit: Boolean(options.audit),
  };
}

function skippedRun(tool: "typescript" | "eslint" | "npm-audit", reason: string): ToolRunResult {
  return {
    tool,
    command: "",
    args: [],
    exitCode: null,
    stdout: "",
    stderr: "",
    all: "",
    skipped: true,
    skipReason: reason,
  };
}

export function resolveRootPath(root: string | undefined): string {
  return path.resolve(root ?? process.cwd());
}
