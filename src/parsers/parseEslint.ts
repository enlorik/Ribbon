import { severityFromEslint } from "../core/classify.js";
import { makeDiagnosticId } from "../core/ids.js";
import type { NormalizedDiagnostic } from "../core/types.js";

interface EslintMessage {
  line?: number;
  column?: number;
  severity?: number;
  ruleId?: string | null;
  message?: string;
}

interface EslintFileResult {
  filePath?: string;
  messages?: EslintMessage[];
}

export function parseEslint(jsonText: string): NormalizedDiagnostic[] {
  if (!jsonText.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const diagnostics: NormalizedDiagnostic[] = [];

  for (const fileResult of parsed as EslintFileResult[]) {
    const filePath = fileResult.filePath;
    for (const msg of fileResult.messages ?? []) {
      const message = msg.message ?? "ESLint issue";
      const diagnostic: NormalizedDiagnostic = {
        id: makeDiagnosticId("eslint", diagnostics.length, `${filePath ?? ""}:${msg.ruleId ?? ""}:${message}`),
        source: "eslint",
        severity: severityFromEslint(msg.severity ?? 0),
        category: "lint",
        message,
        raw: message,
      };
      if (filePath) diagnostic.file = filePath;
      if (typeof msg.line === "number") diagnostic.line = msg.line;
      if (typeof msg.column === "number") diagnostic.column = msg.column;
      if (msg.ruleId) diagnostic.ruleId = msg.ruleId;
      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}
