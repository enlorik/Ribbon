import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { rankOriginCandidates } from "../src/core/originRank.js";
import type { ProjectInfo } from "../src/core/types.js";

function setupProject(): { root: string; project: ProjectInfo } {
  const root = path.join(os.tmpdir(), `ribbon-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  mkdirSync(path.join(root, "src", "types"), { recursive: true });
  writeFileSync(path.join(root, "src", "types", "user.ts"), "export interface User { id: string }\n");
  writeFileSync(path.join(root, "tsconfig.json"), "{}\n");
  writeFileSync(path.join(root, "package.json"), "{}\n");
  writeFileSync(path.join(root, "package-lock.json"), "{}\n");

  const project: ProjectInfo = {
    root,
    packageJsonPath: path.join(root, "package.json"),
    packageManager: "npm",
    lockfile: "package-lock.json",
    hasTsconfig: true,
    tsconfigPath: path.join(root, "tsconfig.json"),
    hasEslintConfig: false,
    scripts: {},
    git: { isRepo: true, changedFiles: ["src/types/user.ts"] },
  };

  return { root, project };
}

describe("rankOriginCandidates", () => {
  it("boosts file containing type name", () => {
    const { root, project } = setupProject();
    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [{ id: "1", source: "typescript", severity: "error", category: "missing-symbol", message: "x", raw: "x", symbol: "name", typeName: "User" }],
        anchor: { id: "1", source: "typescript", severity: "error", category: "missing-symbol", message: "x", raw: "x", symbol: "name", typeName: "User" },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    expect(candidates.some((item) => item.file.endsWith("src/types/user.ts"))).toBe(true);
  });

  it("suggests tsconfig for missing module alias", () => {
    const { root, project } = setupProject();
    const candidates = rankOriginCandidates(
      {
        category: "missing-module",
        diagnostics: [{ id: "1", source: "typescript", severity: "error", category: "missing-module", message: "x", raw: "x", symbol: "@/lib/auth" }],
        anchor: { id: "1", source: "typescript", severity: "error", category: "missing-module", message: "x", raw: "x", symbol: "@/lib/auth" },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    expect(candidates.some((item) => item.file.endsWith("tsconfig.json"))).toBe(true);
  });

  it("suggests package files for audit", () => {
    const { root, project } = setupProject();
    const candidates = rankOriginCandidates(
      {
        category: "security",
        diagnostics: [{ id: "1", source: "npm-audit", severity: "error", category: "security", message: "x", raw: "x", packageName: "vite" }],
        anchor: { id: "1", source: "npm-audit", severity: "error", category: "security", message: "x", raw: "x", packageName: "vite" },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    expect(candidates.some((item) => item.file.endsWith("package.json"))).toBe(true);
    expect(candidates.some((item) => item.file.endsWith("package-lock.json"))).toBe(true);
  });

  it("boosts git changed files", () => {
    const { root, project } = setupProject();
    const candidates = rankOriginCandidates(
      {
        category: "type",
        diagnostics: [{ id: "1", source: "typescript", severity: "error", category: "type", message: "x", raw: "x" }],
        anchor: { id: "1", source: "typescript", severity: "error", category: "type", message: "x", raw: "x" },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    const changed = candidates.find((item) => item.file.endsWith("src/types/user.ts"));
    expect(changed?.score).toBeGreaterThanOrEqual(10);
  });
});
