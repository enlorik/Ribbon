import { classifyTscCode, extractTscSymbol } from "../core/classify.js";
import { makeDiagnosticId } from "../core/ids.js";
import type { NormalizedDiagnostic } from "../core/types.js";

const TSC_LINE = /^(.+)\((\d+),(\d+)\):\s*(?:(error|warning|info)\s+)?(?:(TS\d+)\s*:\s*)?(.+)$/i;

export function parseTsc(output: string): NormalizedDiagnostic[] {
  if (!output.trim()) {
    return [];
  }

  const diagnostics: NormalizedDiagnostic[] = [];
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (/^\s+/.test(line) && diagnostics.length > 0) {
      const last = diagnostics[diagnostics.length - 1];
      if (last) {
        last.raw = `${last.raw}\n${line}`;
        last.message = `${last.message}\n${line.trim()}`;
      }
      continue;
    }

    const match = line.match(TSC_LINE);
    if (!match) {
      continue;
    }

    const [, file = "", lineText = "0", columnText = "0", severityWord, code, message = ""] = match;
    const category = classifyTscCode(code, message);
    const symbolData = extractTscSymbol(code, message);

    const diagnostic: NormalizedDiagnostic = {
      id: makeDiagnosticId("typescript", diagnostics.length, `${file}:${code ?? ""}:${message}`),
      source: "typescript",
      severity: (severityWord?.toLowerCase() as "error" | "warning" | "info") ?? "error",
      category,
      file,
      line: Number(lineText),
      column: Number(columnText),
      message,
      raw: line,
    };
    if (code) diagnostic.code = code;
    if (symbolData.symbol) diagnostic.symbol = symbolData.symbol;
    if (symbolData.typeName) diagnostic.typeName = symbolData.typeName;

    diagnostics.push(diagnostic);
  }

  return diagnostics;
}
