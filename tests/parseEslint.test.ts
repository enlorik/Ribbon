import { describe, expect, it } from "vitest";
import { parseEslint } from "../src/parsers/parseEslint.js";

describe("parseEslint", () => {
  it("parses eslint json array with messages", () => {
    const input = JSON.stringify([
      {
        filePath: "src/app.ts",
        messages: [
          { line: 1, column: 2, severity: 2, ruleId: "no-undef", message: "x is not defined" },
          { line: 3, column: 4, severity: 1, ruleId: "no-console", message: "Unexpected console statement" },
        ],
      },
    ]);

    const result = parseEslint(input);
    expect(result).toHaveLength(2);
    expect(result[0]?.severity).toBe("error");
    expect(result[1]?.severity).toBe("warning");
    expect(result[0]?.ruleId).toBe("no-undef");
  });

  it("handles empty array", () => {
    expect(parseEslint("[]")).toEqual([]);
  });
});
