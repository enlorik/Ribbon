import { clusterCauseRibbons } from "../core/cluster.js";
import { formatCheckOutput } from "../core/formatOutput.js";
import { toJsonOutput } from "../core/jsonOutput.js";
import type { CheckResult, DiagnosticSource, NormalizedDiagnostic } from "../core/types.js";
import { parseEslint } from "../parsers/parseEslint.js";
import { parseNpmAudit } from "../parsers/parseNpmAudit.js";
import { parseUnknownPipeOutput } from "../parsers/parsePipe.js";
import { parseTsc } from "../parsers/parseTsc.js";
import { detectProject } from "../project/detectProject.js";

export interface PipeOptions {
  root?: string;
  tool?: "tsc" | "eslint" | "audit" | "unknown";
  json?: boolean;
  noColor?: boolean;
  verbose?: boolean;
}

export async function runPipe(options: PipeOptions): Promise<number> {
  const input = await readStdin();
  const project = await detectProject(options.root);
  const diagnostics = parsePipeInput(input, options.tool ?? "unknown");
  const clusters = clusterCauseRibbons(diagnostics, project);

  const result: CheckResult = {
    project,
    diagnostics,
    clusters,
    toolRuns: [],
  };

  if (options.json) {
    process.stdout.write(`${toJsonOutput(result, Boolean(options.verbose))}\n`);
  } else {
    process.stdout.write(
      `${formatCheckOutput(result, {
        color: !options.noColor && Boolean(process.stdout.isTTY),
        verbose: Boolean(options.verbose),
      })}\n`,
    );
  }

  return diagnostics.length > 0 ? 1 : 0;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parsePipeInput(input: string, tool: PipeOptions["tool"]): NormalizedDiagnostic[] {
  if (tool === "tsc") {
    return parseTsc(input);
  }
  if (tool === "eslint") {
    return parseEslint(input);
  }
  if (tool === "audit") {
    return parseNpmAudit(input);
  }

  const tscLike = parseTsc(input);
  if (tscLike.length > 0) {
    return tscLike;
  }

  return parseUnknownPipeOutput(input).map((item) => ({ ...item, source: "pipe" as DiagnosticSource }));
}
