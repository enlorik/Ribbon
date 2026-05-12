import { classifyMessageFallback } from "../core/classify.js";
import { makeDiagnosticId } from "../core/ids.js";
import type { DiagnosticSeverity, NormalizedDiagnostic } from "../core/types.js";

export function parseUnknownPipeOutput(output: string): NormalizedDiagnostic[] {
  const diagnostics: NormalizedDiagnostic[] = [];
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (!lowered.includes("error") && !lowered.includes("warning")) {
      continue;
    }

    const severity: DiagnosticSeverity = lowered.includes("error") ? "error" : "warning";
    diagnostics.push({
      id: makeDiagnosticId("unknown", diagnostics.length, line),
      source: "unknown",
      severity,
      category: classifyMessageFallback(line),
      message: line,
      raw: line,
    });
  }

  return diagnostics;
}
