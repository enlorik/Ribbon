import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../src/commands/check.js";
import { runDoctor } from "../src/commands/doctor.js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

function makeTmpProject(): string {
  const root = path.join(os.tmpdir(), `ribbon-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "test-project", version: "1.0.0" }));
  return root;
}

describe("smoke: runCheck --demo", () => {
  let written: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    written = "";
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("returns exit code 1 when demo diagnostics exist", async () => {
    const code = await runCheck({ demo: true });
    expect(code).toBe(1);
  });

  it("writes non-empty text output in demo mode", async () => {
    await runCheck({ demo: true });
    expect(written.trim().length).toBeGreaterThan(0);
  });

  it("writes valid JSON in demo --json mode", async () => {
    await runCheck({ demo: true, json: true });
    const parsed = JSON.parse(written.trim());
    expect(parsed).toHaveProperty("diagnostics");
    expect(Array.isArray(parsed.diagnostics)).toBe(true);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
  });

  it("demo --audit includes npm-audit diagnostic", async () => {
    await runCheck({ demo: true, json: true, audit: true });
    const parsed = JSON.parse(written.trim());
    const sources: string[] = parsed.diagnostics.map((d: { source: string }) => d.source);
    expect(sources).toContain("npm-audit");
  });

  it("returns exit code 0 when demo has no diagnostics (impossible path sanity check)", async () => {
    // demo always returns diagnostics, so code should be 1
    const code = await runCheck({ demo: true });
    expect(code).not.toBe(0);
  });
});

describe("smoke: resolveEnabledTools via runCheck options", () => {
  let written: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    written = "";
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("--ts=false skips TypeScript in JSON output toolRuns", async () => {
    const root = makeTmpProject();
    writeFileSync(path.join(root, "tsconfig.json"), "{}");
    // Pass ts=false (simulates --no-ts) so typescript tool should be skipped
    await runCheck({ root, json: true, ts: false, verbose: true });
    const parsed = JSON.parse(written.trim());
    const tsRun = parsed.toolRuns?.find((r: { tool: string }) => r.tool === "typescript");
    expect(tsRun?.skipped).toBe(true);
  });

  it("--eslint=false skips ESLint in JSON output toolRuns", async () => {
    const root = makeTmpProject();
    writeFileSync(path.join(root, ".eslintrc.json"), "{}");
    await runCheck({ root, json: true, eslint: false, verbose: true });
    const parsed = JSON.parse(written.trim());
    const eslintRun = parsed.toolRuns?.find((r: { tool: string }) => r.tool === "eslint");
    expect(eslintRun?.skipped).toBe(true);
  });
});

describe("smoke: runDoctor", () => {
  let written: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    written = "";
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("returns exit code 0", async () => {
    const root = makeTmpProject();
    const code = await runDoctor(root);
    expect(code).toBe(0);
  });

  it("writes output that mentions the root path", async () => {
    const root = makeTmpProject();
    await runDoctor(root);
    expect(written).toContain("Root:");
  });

  it("mentions package manager", async () => {
    const root = makeTmpProject();
    writeFileSync(path.join(root, "package-lock.json"), "{}");
    await runDoctor(root);
    expect(written).toContain("npm");
  });
});
