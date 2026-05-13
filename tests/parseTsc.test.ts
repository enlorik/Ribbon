import { describe, expect, it } from "vitest";
import { parseTsc } from "../src/parsers/parseTsc.js";

describe("parseTsc", () => {
  it("parses TS2339 property missing", () => {
    const input = "src/types/user.ts(12,8): error TS2339: Property 'name' does not exist on type 'User'.";
    const result = parseTsc(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.file).toBe("src/types/user.ts");
    expect(result[0]?.code).toBe("TS2339");
    expect(result[0]?.category).toBe("missing-symbol");
    expect(result[0]?.symbol).toBe("name");
    expect(result[0]?.typeName).toBe("User");
  });

  it("parses TS2322 type mismatch", () => {
    const input = "src/file.tsx(20,15): error TS2322: Type 'string' is not assignable to type 'number'.";
    const result = parseTsc(input);
    expect(result[0]?.code).toBe("TS2322");
    expect(result[0]?.category).toBe("type");
  });

  it("parses TS2307 module missing", () => {
    const input = "src/app.ts(2,10): error TS2307: Cannot find module '@/lib/auth' or its corresponding type declarations.";
    const result = parseTsc(input);
    expect(result[0]?.category).toBe("missing-module");
    expect(result[0]?.symbol).toBe("@/lib/auth");
  });

  it("parses TS2304 cannot find name", () => {
    const input = "src/app.ts(8,5): error TS2304: Cannot find name 'createClient'.";
    const result = parseTsc(input);
    expect(result[0]?.category).toBe("missing-symbol");
    expect(result[0]?.symbol).toBe("createClient");
  });

  it("parses TS1005 syntax", () => {
    const input = "src/app.ts(13,1): error TS1005: '}' expected.";
    const result = parseTsc(input);
    expect(result[0]?.code).toBe("TS1005");
    expect(result[0]?.category).toBe("syntax");
  });

  it("parses TS1128 syntax", () => {
    const input = "src/app.ts(4,1): error TS1128: Declaration or statement expected.";
    const result = parseTsc(input);
    expect(result[0]?.code).toBe("TS1128");
    expect(result[0]?.category).toBe("syntax");
  });

  it("parses TS2345 as type error", () => {
    const input = "src/app.ts(7,18): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.";
    const result = parseTsc(input);
    expect(result[0]?.code).toBe("TS2345");
    expect(result[0]?.category).toBe("type");
  });

  it("parses TS7006 as type error", () => {
    const input = "src/app.ts(10,15): error TS7006: Parameter 'value' implicitly has an 'any' type.";
    const result = parseTsc(input);
    expect(result[0]?.code).toBe("TS7006");
    expect(result[0]?.category).toBe("type");
  });

  it("parses TS2551 and extracts symbol/type", () => {
    const input = "src/user.ts(4,18): error TS2551: Property 'nmae' does not exist on type 'User'. Did you mean 'name'?";
    const result = parseTsc(input);
    expect(result[0]?.code).toBe("TS2551");
    expect(result[0]?.category).toBe("missing-symbol");
    expect(result[0]?.symbol).toBe("nmae");
    expect(result[0]?.typeName).toBe("User");
  });

  it("parses Windows paths", () => {
    const input = "C:\\repo\\src\\file.ts(12,8): error TS2339: Property 'name' does not exist on type 'User'.";
    const result = parseTsc(input);
    expect(result[0]?.file).toBe("C:\\repo\\src\\file.ts");
    expect(result[0]?.code).toBe("TS2339");
  });

  it("parses multiline diagnostics with indented context", () => {
    const input = [
      "src/file.ts(20,15): error TS2322: Type 'string' is not assignable to type 'number'.",
      "  The expected type comes from property 'count' which is declared here on type 'Config'",
      "  src/types.ts(8,3): 'count' is declared here.",
    ].join("\n");
    const result = parseTsc(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.message).toContain("The expected type comes from property 'count'");
    expect(result[0]?.raw).toContain("src/types.ts(8,3): 'count' is declared here.");
  });

  it("returns empty for empty output", () => {
    expect(parseTsc("")).toEqual([]);
  });

  it("ignores unrelated text", () => {
    const input = [
      "Starting typecheck...",
      "Done in 0.57s.",
      "No diagnostics found.",
    ].join("\n");
    expect(parseTsc(input)).toEqual([]);
  });
});
