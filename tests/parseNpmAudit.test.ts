import { describe, expect, it } from "vitest";
import { parseNpmAudit } from "../src/parsers/parseNpmAudit.js";

describe("parseNpmAudit", () => {
  it("parses vulnerabilities object and maps severities", () => {
    const input = JSON.stringify({
      vulnerabilities: {
        vite: { severity: "high" },
        minimist: { severity: "moderate" },
      },
    });

    const result = parseNpmAudit(input);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.packageName === "vite")?.severity).toBe("error");
    expect(result.find((item) => item.packageName === "minimist")?.severity).toBe("warning");
  });

  it("returns empty for empty vulnerabilities", () => {
    const input = JSON.stringify({ vulnerabilities: {} });
    expect(parseNpmAudit(input)).toEqual([]);
  });
});
