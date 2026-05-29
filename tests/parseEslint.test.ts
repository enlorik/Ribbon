import { describe, expect, it } from "vitest";
import { parseEslint } from "../src/parsers/parseEslint.js";

describe("parseEslint", () => {
  it("parses basic ESLint JSON", () => {
    const input = JSON.stringify([
      {
        filePath: "src/app.ts",
        messages: [
          { line: 1, column: 2, severity: 2, ruleId: "no-undef", message: "x is not defined", endLine: 1, endColumn: 3 },
        ],
      },
    ]);

    const result = parseEslint(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.file).toBe("src/app.ts");
    expect(result[0]?.line).toBe(1);
    expect(result[0]?.column).toBe(2);
    expect(result[0]?.endLine).toBe(1);
    expect(result[0]?.endColumn).toBe(3);
    expect(result[0]?.ruleId).toBe("no-undef");
  });

  it("parses severity 2 as error", () => {
    const input = JSON.stringify([{ filePath: "src/app.ts", messages: [{ severity: 2, message: "bad", ruleId: "no-undef" }] }]);
    const result = parseEslint(input);
    expect(result[0]?.severity).toBe("error");
  });

  it("parses severity 1 as warning", () => {
    const input = JSON.stringify([{ filePath: "src/app.ts", messages: [{ severity: 1, message: "warn", ruleId: "no-console" }] }]);
    const result = parseEslint(input);
    expect(result[0]?.severity).toBe("warning");
  });

  it("handles ruleId null", () => {
    const input = JSON.stringify([{ filePath: "src/app.ts", messages: [{ severity: 2, ruleId: null, message: "Parsing error: Unexpected token" }] }]);
    const result = parseEslint(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleId).toBeUndefined();
  });

  it("handles fix availability", () => {
    const input = JSON.stringify([
      {
        filePath: "src/app.ts",
        messages: [{ severity: 2, ruleId: "semi", message: "Missing semicolon.", fix: { range: [1, 1], text: ";" } }],
      },
    ]);
    const result = parseEslint(input);
    expect(result[0]?.fixable).toBe(true);
  });

  it("handles suggestions", () => {
    const input = JSON.stringify([
      {
        filePath: "src/app.ts",
        messages: [
          {
            severity: 1,
            ruleId: "no-console",
            message: "Unexpected console statement.",
            suggestions: [{ desc: "Remove call", fix: { range: [0, 10], text: "" } }],
          },
        ],
      },
    ]);
    const result = parseEslint(input);
    expect(result[0]?.suggestionsCount).toBe(1);
  });

  it("handles empty messages", () => {
    const input = JSON.stringify([{ filePath: "src/app.ts", messages: [] }]);
    expect(parseEslint(input)).toEqual([]);
  });

  it("invalid JSON returns []", () => {
    expect(parseEslint("{ nope")).toEqual([]);
  });

  it("malformed entries do not throw", () => {
    const input = JSON.stringify([
      null,
      { filePath: "src/a.ts", messages: [null, "bad", { message: "ok", severity: 2, ruleId: "no-undef" }] },
      { filePath: "src/b.ts", messages: {} },
    ]);
    expect(() => parseEslint(input)).not.toThrow();
    const result = parseEslint(input);
    expect(result).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(parseEslint("[]")).toEqual([]);
  });
});
