import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, vi } from "vitest";
import { buildProjectIndex } from "../src/project/projectIndex.js";
import * as fs from "../src/utils/fs.js";
import { rankOriginCandidates } from "../src/core/originRank.js";
import { clusterCauseRibbons } from "../src/core/cluster.js";
import type { ProjectInfo, NormalizedDiagnostic } from "../src/core/types.js";

function makeTmpProject(files: Record<string, string>): string {
  const root = path.join(
    os.tmpdir(),
    `ribbon-idx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const BASE_PROJECT: Omit<ProjectInfo, "root"> = {
  packageManager: "npm",
  hasTsconfig: false,
  hasEslintConfig: false,
  scripts: {},
  git: { isRepo: false, changedFiles: [] },
};

describe("buildProjectIndex", () => {
  it("indexes all project files", () => {
    const root = makeTmpProject({
      "src/a.ts": "export const a = 1;",
      "src/b.ts": "export const b = 2;",
      "package.json": "{}",
    });
    const index = buildProjectIndex(root, 2000);
    expect(index.root).toBe(root);
    expect(index.files.length).toBe(3);
    expect(index.byRelativePath.has("src/a.ts")).toBe(true);
    expect(index.byRelativePath.has("src/b.ts")).toBe(true);
  });

  it("marks non-dist src files as not generated", () => {
    const root = makeTmpProject({
      "src/a.ts": "export const a = 1;",
    });
    const index = buildProjectIndex(root, 2000);
    const srcFile = index.byRelativePath.get("src/a.ts");
    expect(srcFile?.generated).toBe(false);
  });

  it("marks .min.js files as generated", () => {
    const root = makeTmpProject({
      "src/a.ts": "export const a = 1;",
      "src/a.min.js": "const a=1;",
    });
    const index = buildProjectIndex(root, 2000);
    const minFile = index.byRelativePath.get("src/a.min.js");
    expect(minFile?.generated).toBe(true);
  });

  it("uses forward-slash relative paths on all platforms", () => {
    const root = makeTmpProject({
      "src/types/user.ts": "export interface User { id: string }",
    });
    const index = buildProjectIndex(root, 2000);
    const keys = [...index.byRelativePath.keys()];
    expect(keys.every((k) => !k.includes("\\"))).toBe(true);
  });

  it("file ordering is deterministic across calls", () => {
    const root = makeTmpProject({
      "src/c.ts": "const c = 3;",
      "src/a.ts": "const a = 1;",
      "src/b.ts": "const b = 2;",
    });
    const run1 = buildProjectIndex(root, 2000).files.map((f) => f.relativePath);
    const run2 = buildProjectIndex(root, 2000).files.map((f) => f.relativePath);
    expect(run1).toEqual(run2);
  });

  it("respects maxFiles limit", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
      files[`src/file${i}.ts`] = `export const v${i} = ${i};`;
    }
    const root = makeTmpProject(files);
    const index = buildProjectIndex(root, 5);
    expect(index.files.length).toBeLessThanOrEqual(5);
  });

  it("tolerates unreadable files gracefully", () => {
    const root = makeTmpProject({ "src/a.ts": "export const a = 1;" });
    const spy = vi.spyOn(fs, "readTextFile").mockImplementation((p: string) => {
      if (p.endsWith("a.ts")) return undefined;
      return fs.readTextFile(p);
    });
    const index = buildProjectIndex(root, 2000);
    expect(index.files.some((f) => f.relativePath === "src/a.ts")).toBe(true);
    expect(index.byRelativePath.get("src/a.ts")?.text).toBe("");
    spy.mockRestore();
  });

  it("reads each file exactly once (shared index reuse)", () => {
    const root = makeTmpProject({
      "src/types/user.ts": "export interface User { id: string }",
      "src/lib/utils.ts": "export function util() {}",
      "src/app.ts": "import { User } from './types/user.js';",
    });

    const readSpy = vi.spyOn(fs, "readTextFile");
    const index = buildProjectIndex(root, 2000);
    const callsAfterIndex = readSpy.mock.calls.length;

    const project: ProjectInfo = { ...BASE_PROJECT, root };

    const diag1: NormalizedDiagnostic = {
      id: "1", source: "typescript", severity: "error",
      category: "missing-symbol", message: "x", raw: "x",
      symbol: "User", typeName: "User",
    };
    const diag2: NormalizedDiagnostic = {
      id: "2", source: "typescript", severity: "error",
      category: "missing-symbol", message: "y", raw: "y",
      symbol: "util",
    };

    rankOriginCandidates(
      { category: "missing-symbol", diagnostics: [diag1], anchor: diag1 },
      root, project, { maxFiles: 2000, projectIndex: index },
    );
    rankOriginCandidates(
      { category: "missing-symbol", diagnostics: [diag2], anchor: diag2 },
      root, project, { maxFiles: 2000, projectIndex: index },
    );

    const callsAfterRank = readSpy.mock.calls.length;
    expect(callsAfterRank).toBe(callsAfterIndex);

    readSpy.mockRestore();
  });

  it("clusterCauseRibbons builds index once and shares across clusters", () => {
    const root = makeTmpProject({
      "src/types/user.ts": "export interface User { id: string }",
      "src/lib/utils.ts": "export function createClient() {}",
      "src/app.ts": "const x = user.name;",
    });

    const readSpy = vi.spyOn(fs, "readTextFile");
    const readsBeforeCluster = readSpy.mock.calls.length;

    const project: ProjectInfo = { ...BASE_PROJECT, root };
    const diagnostics: NormalizedDiagnostic[] = [
      {
        id: "1", source: "typescript", severity: "error",
        category: "missing-symbol", message: "Property 'name' does not exist on type 'User'.",
        raw: "src/app.ts(1,11): error TS2339: Property 'name' does not exist on type 'User'.",
        code: "TS2339", file: "src/app.ts", symbol: "name", typeName: "User",
      },
      {
        id: "2", source: "typescript", severity: "error",
        category: "missing-symbol", message: "Cannot find name 'createClient'.",
        raw: "src/app.ts(2,5): error TS2304: Cannot find name 'createClient'.",
        code: "TS2304", file: "src/app.ts", symbol: "createClient",
      },
    ];

    const index = buildProjectIndex(root, 2000);
    const readsAfterIndex = readSpy.mock.calls.length;

    clusterCauseRibbons(diagnostics, project, { maxFiles: 2000, projectIndex: index });
    const readsAfterCluster = readSpy.mock.calls.length;

    expect(readsAfterIndex).toBeGreaterThan(readsBeforeCluster);
    expect(readsAfterCluster).toBe(readsAfterIndex);

    readSpy.mockRestore();
  });
});

describe("rankOriginCandidates determinism with ProjectIndex", () => {
  it("produces same candidate ordering across two calls with same index", () => {
    const root = makeTmpProject({
      "src/types/user.ts": "export interface User { id: string }",
      "src/components/Profile.tsx": "const x = user.name;",
    });
    const index = buildProjectIndex(root, 2000);
    const project: ProjectInfo = { ...BASE_PROJECT, root };
    const diag: NormalizedDiagnostic = {
      id: "1", source: "typescript", severity: "error",
      category: "missing-symbol", message: "x", raw: "x",
      symbol: "name", typeName: "User",
    };
    const opts = { maxFiles: 2000, projectIndex: index };

    const run1 = rankOriginCandidates({ category: "missing-symbol", diagnostics: [diag], anchor: diag }, root, project, opts);
    const run2 = rankOriginCandidates({ category: "missing-symbol", diagnostics: [diag], anchor: diag }, root, project, opts);

    expect(run1.map((c) => c.file)).toEqual(run2.map((c) => c.file));
    expect(run1.map((c) => c.score)).toEqual(run2.map((c) => c.score));
  });
});
