import { severityFromEslint } from "../core/classify.js";
import { makeDiagnosticId } from "../core/ids.js";
import type { NormalizedDiagnostic } from "../core/types.js";

interface EslintMessage {
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: number;
  ruleId?: string | null;
  message?: string;
  fatal?: boolean;
  fix?: unknown;
  suggestions?: unknown[];
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

  for (const fileResult of parsed) {
    if (!isObject(fileResult)) {
      continue;
    }
    const filePath = typeof fileResult.filePath === "string" ? fileResult.filePath : undefined;
    const messages = Array.isArray(fileResult.messages) ? fileResult.messages : [];
    for (const messageEntry of messages) {
      if (!isObject(messageEntry)) {
        continue;
      }
      const msg = messageEntry as EslintMessage;
      const message = msg.message ?? "ESLint issue";
      const severityValue =
        typeof msg.severity === "number" ? msg.severity : msg.fatal ? 2 : 0;
      const diagnostic: NormalizedDiagnostic = {
        id: makeDiagnosticId(
          "eslint",
          diagnostics.length,
          `${filePath ?? ""}:${typeof msg.ruleId === "string" ? msg.ruleId : ""}:${message}`,
        ),
        source: "eslint",
        severity: severityFromEslint(severityValue),
        category: "lint",
        message,
        raw: safeStringify({ filePath, message: msg }),
      };
      if (filePath) diagnostic.file = filePath;
      if (typeof msg.line === "number") diagnostic.line = msg.line;
      if (typeof msg.column === "number") diagnostic.column = msg.column;
      if (typeof msg.endLine === "number") diagnostic.endLine = msg.endLine;
      if (typeof msg.endColumn === "number") diagnostic.endColumn = msg.endColumn;
      if (typeof msg.ruleId === "string") diagnostic.ruleId = msg.ruleId;
      if (msg.fix) diagnostic.fixable = true;
      if (Array.isArray(msg.suggestions)) diagnostic.suggestionsCount = msg.suggestions.length;
      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "eslint diagnostic";
  }
}
