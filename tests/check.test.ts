import { describe, expect, it } from "vitest";
import { parsePositiveIntOption, resolveCheckExitCode, resolveEnabledTools } from "../src/commands/check.js";
import type { DiagnosticSource, NormalizedDiagnostic, ToolRunResult } from "../src/core/types.js";

function makeDiag(severity: NormalizedDiagnostic["severity"]): NormalizedDiagnostic {
  return { id: "d1", source: "typescript", severity, category: "type", message: "test", raw: "test" };
}

function makeSkippedRun(tool: DiagnosticSource): ToolRunResult {
  return { tool, command: "", args: [], exitCode: null, stdout: "", stderr: "", all: "", skipped: true, skipReason: "not available" };
}

function makeRun(tool: DiagnosticSource, exitCode = 0): ToolRunResult {
  return { tool, command: "", args: [], exitCode, stdout: "", stderr: "", all: "" };
}

describe("resolveCheckExitCode", () => {
  it("no diagnostics and no tool runs -> 0", () => {
    expect(resolveCheckExitCode([], [], new Set())).toBe(0);
  });

  it("info-only diagnostics -> 0", () => {
    expect(resolveCheckExitCode([makeDiag("info")], [], new Set())).toBe(0);
  });

  it("warning diagnostic -> 1", () => {
    expect(resolveCheckExitCode([makeDiag("warning")], [], new Set())).toBe(1);
  });

  it("error diagnostic -> 1", () => {
    expect(resolveCheckExitCode([makeDiag("error")], [], new Set())).toBe(1);
  });

  it("explicitly requested tool that is skipped -> 2", () => {
    const requested = new Set<DiagnosticSource>(["typescript"]);
    expect(resolveCheckExitCode([], [makeSkippedRun("typescript")], requested)).toBe(2);
  });

  it("automatically skipped tool not in requested set -> 0, not 2", () => {
    expect(resolveCheckExitCode([], [makeSkippedRun("typescript")], new Set())).toBe(0);
  });

  it("normal tsc run with exit code 1 and error diagnostic -> 1, not 2", () => {
    const requested = new Set<DiagnosticSource>(["typescript"]);
    const run = makeRun("typescript", 1);
    expect(resolveCheckExitCode([makeDiag("error")], [run], requested)).toBe(1);
  });

  it("exit 2 takes precedence over diagnostics", () => {
    const requested = new Set<DiagnosticSource>(["typescript"]);
    expect(
      resolveCheckExitCode([makeDiag("error")], [makeSkippedRun("typescript")], requested),
    ).toBe(2);
  });

  it("requested tool ran, exited nonzero, produced no diagnostics -> 2 (binary not installed)", () => {
    const requested = new Set<DiagnosticSource>(["typescript"]);
    const run = makeRun("typescript", 127); // e.g. npx --no-install exits 127
    expect(resolveCheckExitCode([], [run], requested)).toBe(2);
  });

  it("requested tool ran, exited nonzero, produced no diagnostics but not in requested set -> 0", () => {
    const run = makeRun("typescript", 127);
    expect(resolveCheckExitCode([], [run], new Set())).toBe(0);
  });

  it("requested tool ran, exited nonzero, but diagnostics present -> 1, not 2", () => {
    const requested = new Set<DiagnosticSource>(["typescript"]);
    const run = makeRun("typescript", 1);
    expect(resolveCheckExitCode([makeDiag("error")], [run], requested)).toBe(1);
  });
});

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
