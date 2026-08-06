import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { detectPackageManager } from "../src/project/detectPackageManager.js";
import { resolveRecommendedCommands } from "../src/commands/doctor.js";

describe("resolveRecommendedCommands", () => {
  it("tsconfig + ESLint config -> ribbon check", () => {
    const cmds = resolveRecommendedCommands({ hasTsconfig: true, hasEslintConfig: true, packageManager: "npm" });
    expect(cmds[0]).toBe("ribbon check");
  });

  it("tsconfig only -> ribbon check --ts", () => {
    const cmds = resolveRecommendedCommands({ hasTsconfig: true, hasEslintConfig: false, packageManager: "npm" });
    expect(cmds[0]).toBe("ribbon check --ts");
  });

  it("ESLint config only -> ribbon check --eslint", () => {
    const cmds = resolveRecommendedCommands({ hasTsconfig: false, hasEslintConfig: true, packageManager: "npm" });
    expect(cmds[0]).toBe("ribbon check --eslint");
  });

  it("neither -> ribbon check --demo", () => {
    const cmds = resolveRecommendedCommands({ hasTsconfig: false, hasEslintConfig: false, packageManager: "npm" });
    expect(cmds[0]).toBe("ribbon check --demo");
  });

  it("npm + package-lock.json -> also includes ribbon check --audit", () => {
    const cmds = resolveRecommendedCommands({
      hasTsconfig: true,
      hasEslintConfig: true,
      packageManager: "npm",
      lockfile: "package-lock.json",
    });
    expect(cmds).toContain("ribbon check --audit");
  });

  it("pnpm does not include audit recommendation", () => {
    const cmds = resolveRecommendedCommands({
      hasTsconfig: true,
      hasEslintConfig: true,
      packageManager: "pnpm",
      lockfile: "pnpm-lock.yaml",
    });
    expect(cmds).not.toContain("ribbon check --audit");
  });

  it("npm without lockfile does not include audit recommendation", () => {
    const cmds = resolveRecommendedCommands({ hasTsconfig: true, hasEslintConfig: true, packageManager: "npm" });
    expect(cmds).not.toContain("ribbon check --audit");
  });
});

describe("doctor package manager detection", () => {
  it("detects pnpm by lockfile", () => {
    const root = path.join(os.tmpdir(), `ribbon-doctor-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: 9\n");

    const result = detectPackageManager(root, true);
    expect(result.packageManager).toBe("pnpm");
    expect(result.lockfile).toBe("pnpm-lock.yaml");
  });
});
