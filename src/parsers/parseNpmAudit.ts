import { severityFromAudit } from "../core/classify.js";
import { makeDiagnosticId } from "../core/ids.js";
import type { NormalizedDiagnostic } from "../core/types.js";

interface ModernAuditVulnerability {
  severity?: string;
}

interface LegacyAuditAdvisory {
  module_name?: string;
  severity?: string;
  title?: string;
}

export function parseNpmAudit(jsonText: string): NormalizedDiagnostic[] {
  if (!jsonText.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const diagnostics: NormalizedDiagnostic[] = [];

  const modernVulnerabilities = (parsed as { vulnerabilities?: Record<string, ModernAuditVulnerability> }).vulnerabilities;
  if (modernVulnerabilities && typeof modernVulnerabilities === "object") {
    for (const [pkg, detail] of Object.entries(modernVulnerabilities)) {
      const severity = detail?.severity;
      if (!severity) {
        continue;
      }
      diagnostics.push({
        id: makeDiagnosticId("npm-audit", diagnostics.length, `${pkg}:${severity}`),
        source: "npm-audit",
        severity: severityFromAudit(severity),
        category: "security",
        packageName: pkg,
        message: `Package ${pkg} has ${severity} vulnerability`,
        raw: JSON.stringify({ package: pkg, severity }),
      });
    }
    return diagnostics;
  }

  const advisories = (parsed as { advisories?: Record<string, LegacyAuditAdvisory> }).advisories;
  if (advisories && typeof advisories === "object") {
    for (const advisory of Object.values(advisories)) {
      const pkg = advisory.module_name;
      const severity = advisory.severity;
      if (!pkg || !severity) {
        continue;
      }
      diagnostics.push({
        id: makeDiagnosticId("npm-audit", diagnostics.length, `${pkg}:${severity}`),
        source: "npm-audit",
        severity: severityFromAudit(severity),
        category: "security",
        packageName: pkg,
        message: `Package ${pkg} has ${severity} vulnerability`,
        raw: advisory.title ?? `${pkg} ${severity}`,
      });
    }
  }

  return diagnostics;
}
