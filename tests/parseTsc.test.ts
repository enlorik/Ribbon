import { describe, expect, it } from "vitest";
import { parseTsc } from "../src/parsers/parseTsc.js";

describe("parseTsc", () => {
  it("parses TS2339 property missing", () => {
    const input = "src/types/user.ts(12,8): error TS2339: Property 'name' does not exist on type 'User'.";
    const result = parseTsc(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.file).toBe("src/types/user.ts");
    expect(result[0]?.code).toBe("TS2339");
    expect(result[0]?.symbol).toBe("name");
    expect(result[0]?.typeName).toBe("User");
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

  it("returns empty for empty output", () => {
    expect(parseTsc("")).toEqual([]);
  });

  it("classifies TS1005 as syntax", () => {
    const input = "src/app.ts(1,15): error TS1005: ';' expected.";
    const result = parseTsc(input);
    expect(result[0]?.category).toBe("syntax");
  });
});
