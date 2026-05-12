import { makeDiagnosticId } from "../core/ids.js";
import type { NormalizedDiagnostic } from "../core/types.js";

export function createDemoDiagnostics(includeAudit = true): NormalizedDiagnostic[] {
  const diagnostics: NormalizedDiagnostic[] = [
    {
      id: makeDiagnosticId("typescript", 0, "user-name-1"),
      source: "typescript",
      severity: "error",
      category: "missing-symbol",
      file: "src/features/profile/view.ts",
      line: 18,
      column: 10,
      code: "TS2339",
      symbol: "name",
      typeName: "User",
      message: "Property 'name' does not exist on type 'User'.",
      raw: "src/features/profile/view.ts(18,10): error TS2339: Property 'name' does not exist on type 'User'.",
    },
    {
      id: makeDiagnosticId("typescript", 1, "user-name-2"),
      source: "typescript",
      severity: "error",
      category: "missing-symbol",
      file: "src/features/account/card.tsx",
      line: 25,
      column: 14,
      code: "TS2339",
      symbol: "name",
      typeName: "User",
      message: "Property 'name' does not exist on type 'User'.",
      raw: "src/features/account/card.tsx(25,14): error TS2339: Property 'name' does not exist on type 'User'.",
    },
    {
      id: makeDiagnosticId("typescript", 2, "missing-module"),
      source: "typescript",
      severity: "error",
      category: "missing-module",
      file: "src/routes/auth.ts",
      line: 2,
      column: 28,
      code: "TS2307",
      symbol: "@/lib/auth",
      message: "Cannot find module '@/lib/auth' or its corresponding type declarations.",
      raw: "src/routes/auth.ts(2,28): error TS2307: Cannot find module '@/lib/auth' or its corresponding type declarations.",
    },
    {
      id: makeDiagnosticId("eslint", 3, "react-hooks"),
      source: "eslint",
      severity: "warning",
      category: "lint",
      file: "src/components/Form.tsx",
      line: 42,
      column: 6,
      ruleId: "react-hooks/exhaustive-deps",
      message: "React Hook useEffect has a missing dependency: 'submit'.",
      raw: "React Hook useEffect has a missing dependency: 'submit'.",
    },
  ];

  if (includeAudit) {
    diagnostics.push({
      id: makeDiagnosticId("npm-audit", 4, "vite-high"),
      source: "npm-audit",
      severity: "error",
      category: "security",
      packageName: "vite",
      message: "Package vite has high vulnerability",
      raw: "vite high vulnerability",
    });
  }

  return diagnostics;
}
