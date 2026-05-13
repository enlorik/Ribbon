import { describe, expect, it } from "vitest";
import { parsePositiveIntOption, resolveEnabledTools } from "../src/commands/check.js";

describe("resolveEnabledTools", () => {
  it("default: uses hasTsconfig and hasEslintConfig", () => {
    const result = resolveEnabledTools({}, true, true);
    expect(result.ts).toBe(true);
    expect(result.eslint).toBe(true);
  });

  it("default with no configs detected: both false", () => {
    const result = resolveEnabledTools({}, false, false);
    expect(result.ts).toBe(false);
    expect(result.eslint).toBe(false);
  });

  it("ts true only: TypeScript true, ESLint false", () => {
    const result = resolveEnabledTools({ ts: true }, true, true);
    expect(result.ts).toBe(true);
    expect(result.eslint).toBe(false);
  });

  it("eslint true only: TypeScript false, ESLint true", () => {
    const result = resolveEnabledTools({ eslint: true }, true, true);
    expect(result.ts).toBe(false);
    expect(result.eslint).toBe(true);
  });

  it("ts false: TypeScript false even when tsconfig present", () => {
    const result = resolveEnabledTools({ ts: false }, true, true);
    expect(result.ts).toBe(false);
    expect(result.eslint).toBe(true);
  });

  it("eslint false: ESLint false even when eslint config present", () => {
    const result = resolveEnabledTools({ eslint: false }, true, true);
    expect(result.ts).toBe(true);
    expect(result.eslint).toBe(false);
  });

  it("ts true and eslint true: both true", () => {
    const result = resolveEnabledTools({ ts: true, eslint: true }, false, false);
    expect(result.ts).toBe(true);
    expect(result.eslint).toBe(true);
  });

  it("ts false and eslint true: TypeScript false, ESLint true", () => {
    const result = resolveEnabledTools({ ts: false, eslint: true }, true, true);
    expect(result.ts).toBe(false);
    expect(result.eslint).toBe(true);
  });

  it("ts true and eslint false: TypeScript true, ESLint false", () => {
    const result = resolveEnabledTools({ ts: true, eslint: false }, true, true);
    expect(result.ts).toBe(true);
    expect(result.eslint).toBe(false);
  });

  it("audit flag is passed through", () => {
    const result = resolveEnabledTools({ audit: true }, false, false);
    expect(result.audit).toBe(true);
  });

  it("audit defaults to false when not set", () => {
    const result = resolveEnabledTools({}, false, false);
    expect(result.audit).toBe(false);
  });
});

describe("parsePositiveIntOption", () => {
  it("undefined returns fallback", () => {
    expect(parsePositiveIntOption(undefined, 2000)).toBe(2000);
  });

  it("valid positive integer string returns parsed value", () => {
    expect(parsePositiveIntOption("500", 2000)).toBe(500);
  });

  it("invalid string returns fallback", () => {
    expect(parsePositiveIntOption("abc", 2000)).toBe(2000);
  });

  it("zero returns fallback", () => {
    expect(parsePositiveIntOption("0", 2000)).toBe(2000);
  });

  it("negative number returns fallback", () => {
    expect(parsePositiveIntOption("-10", 2000)).toBe(2000);
  });

  it("decimal is floored", () => {
    expect(parsePositiveIntOption("3.9", 2000)).toBe(3);
  });

  it("decimal below 1 returns fallback", () => {
    expect(parsePositiveIntOption("0.9", 2000)).toBe(2000);
  });

  it("large valid integer returns correctly", () => {
    expect(parsePositiveIntOption("99999", 2000)).toBe(99999);
  });
});
