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

function writeProjectFile(root: string, relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

describe("rankOriginCandidates", () => {
  it("prefers type definition file for TS2339 missing property", () => {
    const { root, project } = setupProject();
    writeProjectFile(root, "src/components/Profile.tsx", "const x = user.name;\n");
    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [
          {
            id: "1",
            source: "typescript",
            severity: "error",
            category: "missing-symbol",
            message: "Property 'name' does not exist on type 'User'.",
            raw: "src/components/Profile.tsx(12,8): error TS2339: Property 'name' does not exist on type 'User'.",
            code: "TS2339",
            file: "src/components/Profile.tsx",
            symbol: "name",
            typeName: "User",
          },
        ],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "src/components/Profile.tsx(12,8): error TS2339: Property 'name' does not exist on type 'User'.",
          code: "TS2339",
          file: "src/components/Profile.tsx",
          symbol: "name",
          typeName: "User",
        },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    expect(candidates[0]?.file).toBe("src/types/user.ts");
    expect(candidates[0]?.reasons).toContain("contains type User");
  });

  it("ranks defining file above diagnostic file for missing symbol", () => {
    const { root, project } = setupProject();
    writeProjectFile(root, "src/lib/client.ts", "export function createClient() {}\n");
    writeProjectFile(root, "src/app.ts", "createClient();\n");
    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [
          {
            id: "1",
            source: "typescript",
            severity: "error",
            category: "missing-symbol",
            message: "Cannot find name 'createClient'.",
            raw: "src/app.ts(8,5): error TS2304: Cannot find name 'createClient'.",
            code: "TS2304",
            file: "src/app.ts",
            symbol: "createClient",
          },
        ],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Cannot find name 'createClient'.",
          raw: "src/app.ts(8,5): error TS2304: Cannot find name 'createClient'.",
          code: "TS2304",
          file: "src/app.ts",
          symbol: "createClient",
        },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    const symbolDefIndex = candidates.findIndex((item) => item.file === "src/lib/client.ts");
    const appIndex = candidates.findIndex((item) => item.file === "src/app.ts");
    expect(symbolDefIndex).toBeGreaterThanOrEqual(0);
    expect(appIndex).toBeGreaterThanOrEqual(0);
    expect(symbolDefIndex).toBeLessThan(appIndex);
    expect(candidates[symbolDefIndex]?.reasons).toContain("defines symbol createClient");
  });

  it("ranks exact module path candidate for missing module alias", () => {
    const { root, project } = setupProject();
    writeProjectFile(root, "src/lib/auth.ts", "export const auth = true;\n");
    writeProjectFile(root, "src/app.ts", "import { auth } from '@/lib/auth';\n");
    const candidates = rankOriginCandidates(
      {
        category: "missing-module",
        diagnostics: [
          {
            id: "1",
            source: "typescript",
            severity: "error",
            category: "missing-module",
            message: "Cannot find module '@/lib/auth'.",
            raw: "src/app.ts(1,22): error TS2307: Cannot find module '@/lib/auth'.",
            file: "src/app.ts",
            symbol: "@/lib/auth",
          },
        ],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-module",
          message: "Cannot find module '@/lib/auth'.",
          raw: "src/app.ts(1,22): error TS2307: Cannot find module '@/lib/auth'.",
          file: "src/app.ts",
          symbol: "@/lib/auth",
        },
      },
      root,
      project,
      { maxFiles: 2000 },
    );

    const moduleIndex = candidates.findIndex((item) => item.file === "src/lib/auth.ts");
    expect(moduleIndex).toBeGreaterThanOrEqual(0);
    expect(moduleIndex).toBeLessThanOrEqual(1);
    expect(candidates[moduleIndex]?.reasons).toContain("exact missing module path candidate");
    expect(candidates.some((item) => item.file.endsWith("tsconfig.json"))).toBe(true);
    expect(candidates.some((item) => item.file.endsWith("package.json"))).toBe(true);
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

  it("uses normalized forward-slash paths for candidates", () => {
    const { root, project } = setupProject();
    const projectWithWindowsPath: ProjectInfo = {
      ...project,
      git: {
        isRepo: true,
        changedFiles: ["src\\types\\user.ts"],
      },
    };
    const candidates = rankOriginCandidates(
      {
        category: "type",
        diagnostics: [{ id: "1", source: "typescript", severity: "error", category: "type", message: "x", raw: "x" }],
      },
      root,
      projectWithWindowsPath,
      { maxFiles: 2000 },
    );

    expect(candidates.some((item) => item.file === "src/types/user.ts")).toBe(true);
    expect(candidates.every((item) => !item.file.includes("\\"))).toBe(true);
  });

  it("applies generated-file penalty to lower ranking", () => {
    const { root, project } = setupProject();
    writeProjectFile(root, "dist/types/user.js", "class User {}\n");
    const projectWithGeneratedChange: ProjectInfo = {
      ...project,
      git: {
        isRepo: true,
        changedFiles: ["src/types/user.ts", "dist/types/user.js"],
      },
    };
    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [
          {
            id: "1",
            source: "typescript",
            severity: "error",
            category: "missing-symbol",
            message: "Property 'name' does not exist on type 'User'.",
            raw: "x",
            symbol: "name",
            typeName: "User",
          },
        ],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          symbol: "name",
          typeName: "User",
        },
      },
      root,
      projectWithGeneratedChange,
      { maxFiles: 2000 },
    );

    const srcCandidate = candidates.find((item) => item.file === "src/types/user.ts");
    const distCandidate = candidates.find((item) => item.file === "dist/types/user.js");
    expect(srcCandidate).toBeDefined();
    expect(distCandidate).toBeDefined();
    expect((srcCandidate?.score ?? 0)).toBeGreaterThan(distCandidate?.score ?? 0);
    expect(distCandidate?.reasons).toContain("generated file penalty");
  });
});
