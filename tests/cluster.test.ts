import { describe, expect, it } from "vitest";
import { clusterCauseRibbons } from "../src/core/cluster.js";
import type { NormalizedDiagnostic } from "../src/core/types.js";

function diagnostic(overrides: Partial<NormalizedDiagnostic>): NormalizedDiagnostic {
  return {
    id: Math.random().toString(),
    source: "typescript",
    severity: "error",
    category: "type",
    message: "msg",
    raw: "raw",
    ...overrides,
  };
}

describe("clusterCauseRibbons", () => {
  it("clusters TS2339 User.name together", () => {
    const data = [
      diagnostic({ code: "TS2339", category: "missing-symbol", symbol: "name", typeName: "User", file: "a.ts" }),
      diagnostic({ code: "TS2339", category: "missing-symbol", symbol: "name", typeName: "User", file: "b.ts" }),
    ];

    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.title).toContain("Missing property: User.name");
  });

  it("clusters TS2307 same module", () => {
    const data = [
      diagnostic({ code: "TS2307", category: "missing-module", symbol: "@/lib/auth", file: "a.ts" }),
      diagnostic({ code: "TS2307", category: "missing-module", symbol: "@/lib/auth", file: "b.ts" }),
    ];
    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.title).toBe("Missing module: @/lib/auth");
  });

  it("groups syntax errors in same file and nearby lines", () => {
    const data = [
      diagnostic({ code: "TS1005", category: "syntax", file: "src/a.ts", line: 13 }),
      diagnostic({ code: "TS1128", category: "syntax", file: "src/a.ts", line: 19 }),
      diagnostic({ code: "TS1005", category: "syntax", file: "src/a.ts", line: 44 }),
    ];
    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.title).toContain("Syntax issue near src/a.ts");
  });

  it("does not collapse TS2322 across different files", () => {
    const data = [
      diagnostic({ code: "TS2322", category: "type", file: "src/a.ts" }),
      diagnostic({ code: "TS2322", category: "type", file: "src/b.ts" }),
    ];
    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(2);
  });

  it("clusters eslint by rule", () => {
    const data = [
      diagnostic({ source: "eslint", category: "lint", ruleId: "no-undef" }),
      diagnostic({ source: "eslint", category: "lint", ruleId: "no-undef", severity: "warning" }),
    ];
    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.title).toContain("Lint rule: no-undef");
  });

  it("same ruleId clusters together", () => {
    const data = [
      diagnostic({ source: "eslint", category: "lint", ruleId: "react-hooks/exhaustive-deps", file: "a.tsx" }),
      diagnostic({ source: "eslint", category: "lint", ruleId: "react-hooks/exhaustive-deps", file: "b.tsx" }),
    ];
    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.title).toBe("Lint rule: react-hooks/exhaustive-deps");
  });

  it("fixable lint diagnostics add fix available to evidence", () => {
    const clusters = clusterCauseRibbons([
      diagnostic({ source: "eslint", category: "lint", ruleId: "semi", fixable: true }),
      diagnostic({ source: "eslint", category: "lint", ruleId: "semi" }),
    ]);
    expect(clusters[0]?.evidence).toContain("fix available");
    expect(clusters[0]?.suggestedFirstAction).toContain("ESLint --fix");
  });

  it("suggestions add suggestions available to evidence", () => {
    const clusters = clusterCauseRibbons([
      diagnostic({ source: "eslint", category: "lint", ruleId: "no-console", suggestionsCount: 2 }),
    ]);
    expect(clusters[0]?.evidence).toContain("suggestions available");
  });

  it("null ruleId parser/fatal message gets useful title", () => {
    const clusters = clusterCauseRibbons([
      diagnostic({
        source: "eslint",
        category: "lint",
        ruleId: undefined,
        message: "Parsing error: Unexpected token",
        file: "src/app.ts",
      }),
    ]);
    expect(clusters[0]?.title).toBe("Lint parser error");
  });

  it("singleton still produces cluster", () => {
    const clusters = clusterCauseRibbons([diagnostic({ code: "TS2322", category: "type" })]);
    expect(clusters).toHaveLength(1);
  });

  it("confidence is in expected range", () => {
    const clusters = clusterCauseRibbons([
      diagnostic({ code: "TS2304", category: "missing-symbol", symbol: "createClient" }),
      diagnostic({ code: "TS2304", category: "missing-symbol", symbol: "createClient" }),
    ]);
    expect(clusters[0]?.confidence).toBeGreaterThanOrEqual(0.45);
    expect(clusters[0]?.confidence).toBeLessThanOrEqual(1);
  });
});
