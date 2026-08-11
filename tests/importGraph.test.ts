import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { buildImportGraph, isReachable } from "../src/project/importGraph.js";
import { rankOriginCandidates } from "../src/core/originRank.js";
import type { ProjectInfo } from "../src/core/types.js";

// ── unit tests for buildImportGraph / isReachable ─────────────────────────────

describe("buildImportGraph", () => {
  it("builds edges for relative import", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import { x } from './b.js';\n" },
      { relativePath: "src/b.ts", text: "export const x = 1;\n" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")).toContain("src/b.ts");
  });

  it("resolves extensionless TS imports", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import './b';\n" },
      { relativePath: "src/b.ts", text: "" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")).toContain("src/b.ts");
  });

  it("resolves index files", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import './utils';\n" },
      { relativePath: "src/utils/index.ts", text: "" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")).toContain("src/utils/index.ts");
  });

  it("resolves re-export chain (case C)", () => {
    const files = [
      { relativePath: "src/Profile.ts", text: "import { User } from './models/index.js';\n" },
      { relativePath: "src/models/index.ts", text: "export { User } from './user.js';\n" },
      { relativePath: "src/models/user.ts", text: "export interface User { id: string }\n" },
    ];
    const graph = buildImportGraph(files);
    expect(isReachable(graph, "src/Profile.ts", "src/models/user.ts")).toBe(true);
  });

  it("terminates on import cycles (case D)", () => {
    const files = [
      { relativePath: "a.ts", text: "import './b.js';\n" },
      { relativePath: "b.ts", text: "import './a.js';\n" },
    ];
    const graph = buildImportGraph(files);
    expect(isReachable(graph, "a.ts", "c.ts")).toBe(false);
    expect(isReachable(graph, "a.ts", "b.ts")).toBe(true);
  });

  it("resolves tsconfig alias imports with baseUrl (case E)", () => {
    // common layout: baseUrl "." with paths that include directory
    const filesA = [
      { relativePath: "src/Profile.ts", text: "import { User } from '@/types/user';\n" },
      { relativePath: "src/types/user.ts", text: "export interface User { id: string }\n" },
    ];
    const g1 = buildImportGraph(filesA, { baseUrl: ".", paths: { "@/*": ["src/*"] } });
    expect(g1.outgoing.get("src/Profile.ts")).toContain("src/types/user.ts");

    // baseUrl "src" with paths that map @/user -> types/user (needs baseUrl prefix)
    const filesB = [
      { relativePath: "src/Profile.ts", text: "import { User } from '@/user';\n" },
      { relativePath: "src/types/user.ts", text: "export interface User { id: string }\n" },
    ];
    const g2 = buildImportGraph(filesB, { baseUrl: "src", paths: { "@/*": ["types/*"] } });
    expect(g2.outgoing.get("src/Profile.ts")).toContain("src/types/user.ts");
  });

  it("ignores package imports and missing files (case F)", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import express from 'express';\nimport './missing';\n" },
    ];
    expect(() => buildImportGraph(files)).not.toThrow();
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")?.size).toBe(0);
  });

  it("ignores node: builtins", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import fs from 'node:fs';\n" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")?.size).toBe(0);
  });

  it("ignores dynamic template imports", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import(`./modules/${name}`);\n" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")?.size).toBe(0);
  });

  it("ignores commented-out imports", () => {
    const files = [
      { relativePath: "src/a.ts", text: "// import './legacy.js'\n/* from './old.js' */\n" },
      { relativePath: "src/legacy.ts", text: "" },
      { relativePath: "src/old.ts", text: "" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")?.size).toBe(0);
  });

  it("strips .jsx extension for TSX resolution", () => {
    const files = [
      { relativePath: "src/a.ts", text: "import './Button.jsx';\n" },
      { relativePath: "src/Button.tsx", text: "" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")).toContain("src/Button.tsx");
  });

  it("resolves bare specifier relative to baseUrl (case E extended)", () => {
    const files = [
      { relativePath: "src/Profile.ts", text: "import { User } from 'types/user';\n" },
      { relativePath: "src/types/user.ts", text: "export interface User { id: string }\n" },
    ];
    const graph = buildImportGraph(files, { baseUrl: "src" });
    expect(graph.outgoing.get("src/Profile.ts")).toContain("src/types/user.ts");
  });

  it("export * from resolves correctly", () => {
    const files = [
      { relativePath: "src/index.ts", text: "export * from './lib/core.js';\n" },
      { relativePath: "src/lib/core.ts", text: "export const x = 1;\n" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/index.ts")).toContain("src/lib/core.ts");
  });

  it("does not create edges from import-like text inside string literals", () => {
    const files = [
      { relativePath: "src/a.ts", text: `const note = "copied from './legacy/user'";\n` },
      { relativePath: "src/legacy/user.ts", text: "" },
    ];
    const graph = buildImportGraph(files);
    expect(graph.outgoing.get("src/a.ts")?.size).toBe(0);
  });
});

describe("isReachable", () => {
  it("returns true for self", () => {
    const graph = buildImportGraph([{ relativePath: "a.ts", text: "" }]);
    expect(isReachable(graph, "a.ts", "a.ts")).toBe(true);
  });

  it("returns true for direct import", () => {
    const graph = buildImportGraph([
      { relativePath: "a.ts", text: "import './b.js';\n" },
      { relativePath: "b.ts", text: "" },
    ]);
    expect(isReachable(graph, "a.ts", "b.ts")).toBe(true);
  });

  it("returns false for unconnected files", () => {
    const graph = buildImportGraph([
      { relativePath: "a.ts", text: "" },
      { relativePath: "b.ts", text: "" },
    ]);
    expect(isReachable(graph, "a.ts", "b.ts")).toBe(false);
  });

  it("traverses deep chains without a depth limit", () => {
    // a -> b -> c -> d -> e: all reachable despite many hops
    const graph = buildImportGraph([
      { relativePath: "a.ts", text: "import './b.js';\n" },
      { relativePath: "b.ts", text: "import './c.js';\n" },
      { relativePath: "c.ts", text: "import './d.js';\n" },
      { relativePath: "d.ts", text: "import './e.js';\n" },
      { relativePath: "e.ts", text: "" },
    ]);
    expect(isReachable(graph, "a.ts", "e.ts")).toBe(true);
    expect(isReachable(graph, "a.ts", "c.ts")).toBe(true);
    expect(isReachable(graph, "e.ts", "a.ts")).toBe(false);
  });
});

// ── integration tests: reachability in origin ranking ────────────────────────

function makeTmpRoot(): string {
  return path.join(os.tmpdir(), `ribbon-ig-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function writeFile(root: string, rel: string, content: string): void {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

describe("rankOriginCandidates with reachability", () => {
  it("adds reachable from diagnostic file reason when imported (case A)", () => {
    const root = makeTmpRoot();
    writeFile(root, "src/types/user.ts", "export interface User { id: string }\n");
    writeFile(root, "src/Profile.tsx", "import type { User } from './types/user.js';\nexport function f(u: User) { return u.name; }\n");

    const project: ProjectInfo = {
      root,
      packageManager: "npm",
      hasTsconfig: true,
      hasEslintConfig: false,
      scripts: {},
    };

    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [{
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          code: "TS2339",
          file: "src/Profile.tsx",
          symbol: "name",
          typeName: "User",
        }],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          code: "TS2339",
          file: "src/Profile.tsx",
          symbol: "name",
          typeName: "User",
        },
      },
      root,
      project,
      { maxFiles: 200 },
    );

    const userCandidate = candidates.find((c) => c.file === "src/types/user.ts");
    expect(userCandidate).toBeDefined();
    expect(userCandidate?.reasons).toContain("reachable from diagnostic file");
    expect(candidates[0]?.file).toBe("src/types/user.ts");
  });

  it("handles absolute diagnostic file paths from tsc output", () => {
    const root = makeTmpRoot();
    writeFile(root, "src/types/user.ts", "export interface User { id: string }\n");
    writeFile(root, "src/Profile.tsx", "import type { User } from './types/user.js';\nexport function f(u: User) { return u.name; }\n");

    const project: ProjectInfo = {
      root,
      packageManager: "npm",
      hasTsconfig: true,
      hasEslintConfig: false,
      scripts: {},
    };

    const absoluteFile = path.join(root, "src/Profile.tsx");
    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [{
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          code: "TS2339",
          file: absoluteFile,
          symbol: "name",
          typeName: "User",
        }],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          code: "TS2339",
          file: absoluteFile,
          symbol: "name",
          typeName: "User",
        },
      },
      root,
      project,
      { maxFiles: 200 },
    );

    const userCandidate = candidates.find((c) => c.file === "src/types/user.ts");
    expect(userCandidate?.reasons).toContain("reachable from diagnostic file");
  });

  it("reachable definition outranks unrelated duplicate definition (case B)", () => {
    const root = makeTmpRoot();
    writeFile(root, "src/types/user.ts", "export interface User { id: string }\n");
    writeFile(root, "src/legacy/user.ts", "export interface User { id: string }\n");
    writeFile(root, "src/Profile.tsx", "import type { User } from './types/user.js';\nexport function f(u: User) { return u.name; }\n");

    const project: ProjectInfo = {
      root,
      packageManager: "npm",
      hasTsconfig: true,
      hasEslintConfig: false,
      scripts: {},
    };

    const candidates = rankOriginCandidates(
      {
        category: "missing-symbol",
        diagnostics: [{
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          code: "TS2339",
          file: "src/Profile.tsx",
          symbol: "name",
          typeName: "User",
        }],
        anchor: {
          id: "1",
          source: "typescript",
          severity: "error",
          category: "missing-symbol",
          message: "Property 'name' does not exist on type 'User'.",
          raw: "x",
          code: "TS2339",
          file: "src/Profile.tsx",
          symbol: "name",
          typeName: "User",
        },
      },
      root,
      project,
      { maxFiles: 200 },
    );

    const reachableIdx = candidates.findIndex((c) => c.file === "src/types/user.ts");
    const unreachableIdx = candidates.findIndex((c) => c.file === "src/legacy/user.ts");
    expect(reachableIdx).toBeGreaterThanOrEqual(0);
    expect(unreachableIdx).toBeGreaterThanOrEqual(0);
    expect(reachableIdx).toBeLessThan(unreachableIdx);
  });
});
