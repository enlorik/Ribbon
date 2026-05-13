import type {
  DiagnosticCategory,
  DiagnosticSeverity,
} from "./types.js";

export function classifyTscCode(code: string | undefined, message: string): DiagnosticCategory {
  const normalized = message.toLowerCase();
  if (code === "TS2307" || code === "TS2792" || normalized.includes("cannot find module")) {
    return "missing-module";
  }
  if (
    code === "TS2304" ||
    code === "TS2339" ||
    code === "TS2551" ||
    code === "TS2552" ||
    normalized.includes("does not exist on type")
  ) {
    return "missing-symbol";
  }
  if (
    code === "TS1005" ||
    code === "TS1128" ||
    code === "TS1109" ||
    code === "TS1131" ||
    normalized.includes("expected")
  ) {
    return "syntax";
  }
  if (code === "TS2322" || code === "TS2345" || code === "TS7006" || code === "TS2769") {
    return "type";
  }
  return "type";
}

export function extractTscSymbol(
  code: string | undefined,
  message: string,
): { symbol?: string; typeName?: string } {
  const cannotFindModule = message.match(/Cannot find module ['"]([^'"]+)['"]/i);
  if (cannotFindModule?.[1]) {
    return { symbol: cannotFindModule[1] };
  }

  const cannotFindName = message.match(/Cannot find name ['"]([^'"]+)['"]/i);
  if (cannotFindName?.[1]) {
    return { symbol: cannotFindName[1] };
  }

  const missingProperty = message.match(/Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/i);
  if (missingProperty?.[1] && missingProperty?.[2]) {
    return { symbol: missingProperty[1], typeName: missingProperty[2] };
  }

  if (code === "TS2551") {
    const missingWithSuggestion = message.match(
      /Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]\.\s*Did you mean ['"]([^'"]+)['"]\?/i,
    );
    if (missingWithSuggestion?.[1] && missingWithSuggestion?.[2]) {
      return { symbol: missingWithSuggestion[1], typeName: missingWithSuggestion[2] };
    }
  }

  const missingExportMember = message.match(
    /Module ['"]([^'"]+)['"] has no exported member ['"]([^'"]+)['"]/i,
  );
  if (missingExportMember?.[2]) {
    return { symbol: missingExportMember[2] };
  }

  return {};
}

export function classifyMessageFallback(message: string): DiagnosticCategory {
  const normalized = message.toLowerCase();
  if (normalized.includes("module") && normalized.includes("cannot find")) {
    return "missing-module";
  }
  if (normalized.includes("cannot find") || normalized.includes("does not exist")) {
    return "missing-symbol";
  }
  if (normalized.includes("syntax") || normalized.includes("unexpected") || normalized.includes("expected")) {
    return "syntax";
  }
  if (normalized.includes("eslint") || normalized.includes("rule")) {
    return "lint";
  }
  if (normalized.includes("vulnerab")) {
    return "security";
  }
  if (normalized.includes("config")) {
    return "config";
  }
  return "unknown";
}

export function severityFromEslint(value: number): DiagnosticSeverity {
  if (value >= 2) {
    return "error";
  }
  if (value === 1) {
    return "warning";
  }
  return "info";
}

export function severityFromAudit(severity: string | undefined): DiagnosticSeverity {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "error";
    case "moderate":
      return "warning";
    default:
      return "info";
  }
}
