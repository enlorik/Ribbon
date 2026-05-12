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
      diagnostic({ code: "TS2307", category: "missing-module", symbol: "@/lib/auth" }),
      diagnostic({ code: "TS2307", category: "missing-module", symbol: "@/lib/auth" }),
    ];
    const clusters = clusterCauseRibbons(data);
    expect(clusters).toHaveLength(1);
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
