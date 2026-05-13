import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { readTsconfigPaths, resolveTsconfigAlias } from "../src/project/tsconfigPaths.js";
import { rankOriginCandidates } from "../src/core/originRank.js";
import type { ProjectInfo } from "../src/core/types.js";

function tmpDir(): string {
  const dir = path.join(os.tmpdir(), `ribbon-tsc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data));
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// ---------------------------------------------------------------------------
// readTsconfigPaths
// ---------------------------------------------------------------------------

describe("readTsconfigPaths", () => {
  it("reads compilerOptions.paths from a valid tsconfig", () => {
    const dir = tmpDir();
    const tsconfigPath = path.join(dir, "tsconfig.json");
    writeJson(tsconfigPath, {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["src/*"] },
      },
    });

    const result = readTsconfigPaths(tsconfigPath);
    expect(result).toBeDefined();
    expect(result?.paths).toEqual({ "@/*": ["src/*"] });
    expect(result?.baseUrl).toBe(".");
  });

  it("reads multiple path aliases", () => {
    const dir = tmpDir();
    const tsconfigPath = path.join(dir, "tsconfig.json");
    writeJson(tsconfigPath, {
      compilerOptions: {
        paths: {
          "@/*": ["src/*"],
          "@lib/*": ["src/lib/*"],
          "@components/*": ["src/components/*"],
        },
      },
    });

    const result = readTsconfigPaths(tsconfigPath);
    expect(result?.paths).toEqual({
      "@/*": ["src/*"],
      "@lib/*": ["src/lib/*"],
      "@components/*": ["src/components/*"],
    });
  });

  it("returns undefined for a missing tsconfig file", () => {
    const result = readTsconfigPaths("/nonexistent/path/tsconfig.json");
    expect(result).toBeUndefined();
  });

  it("returns undefined for invalid JSON", () => {
    const dir = tmpDir();
    const tsconfigPath = path.join(dir, "tsconfig.json");
    writeFileSync(tsconfigPath, "not valid json {{{");

    const result = readTsconfigPaths(tsconfigPath);
    expect(result).toBeUndefined();
  });

  it("returns undefined for an empty tsconfig (no compilerOptions)", () => {
    const dir = tmpDir();
    const tsconfigPath = path.join(dir, "tsconfig.json");
    writeJson(tsconfigPath, {});

    const result = readTsconfigPaths(tsconfigPath);
    expect(result).toBeUndefined();
  });

  it("returns undefined when compilerOptions has no baseUrl or paths", () => {
    const dir = tmpDir();
    const tsconfigPath = path.join(dir, "tsconfig.json");
    writeJson(tsconfigPath, { compilerOptions: { strict: true } });

    const result = readTsconfigPaths(tsconfigPath);
    expect(result).toBeUndefined();
  });

  it("does not throw for a missing or invalid tsconfig", () => {
    expect(() => readTsconfigPaths("/nonexistent/tsconfig.json")).not.toThrow();

    const dir = tmpDir();
    const tsconfigPath = path.join(dir, "tsconfig.json");
    writeFileSync(tsconfigPath, "{ invalid json }");
    expect(() => readTsconfigPaths(tsconfigPath)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveTsconfigAlias
// ---------------------------------------------------------------------------

describe("resolveTsconfigAlias", () => {
  it('maps "@/lib/auth" via "@/*": ["src/*"]', () => {
    const result = resolveTsconfigAlias("@/lib/auth", {
      paths: { "@/*": ["src/*"] },
    });
    expect(result).toContain("src/lib/auth");
  });

  it('maps "@lib/auth" via "@lib/*": ["src/lib/*"]', () => {
    const result = resolveTsconfigAlias("@lib/auth", {
      paths: { "@lib/*": ["src/lib/*"] },
    });
    expect(result).toContain("src/lib/auth");
  });

  it('maps "@components/Button" via "@components/*": ["src/components/*"]', () => {
    const result = resolveTsconfigAlias("@components/Button", {
      paths: { "@components/*": ["src/components/*"] },
    });
    expect(result).toContain("src/components/Button");
  });

  it('maps "~/*" alias to "src/*"', () => {
    const result = resolveTsconfigAlias("~/utils/format", {
      paths: { "~/*": ["src/*"] },
    });
    expect(result).toContain("src/utils/format");
  });

  it("returns empty array when no aliases match the symbol", () => {
    const result = resolveTsconfigAlias("some-external-lib", {
      paths: { "@/*": ["src/*"] },
    });
    expect(result).toHaveLength(0);
  });

  it("returns empty array when paths is undefined", () => {
    const result = resolveTsconfigAlias("@/lib/auth", {});
    expect(result).toHaveLength(0);
  });

  it("handles multiple matching targets for a single alias", () => {
    const result = resolveTsconfigAlias("@/lib/auth", {
      paths: { "@/*": ["src/*", "fallback/*"] },
    });
    expect(result).toContain("src/lib/auth");
    expect(result).toContain("fallback/lib/auth");
  });
});

// ---------------------------------------------------------------------------
// rankOriginCandidates – tsconfig path alias integration
// ---------------------------------------------------------------------------

function setupTsconfigProject(tsconfigContent: unknown): { root: string; project: ProjectInfo } {
  const root = tmpDir();
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeJson(path.join(root, "tsconfig.json"), tsconfigContent);
  writeJson(path.join(root, "package.json"), {});

  const project: ProjectInfo = {
    root,
    packageJsonPath: path.join(root, "package.json"),
    packageManager: "npm",
    hasTsconfig: true,
    tsconfigPath: path.join(root, "tsconfig.json"),
    hasEslintConfig: false,
    scripts: {},
    git: { isRepo: false, changedFiles: [] },
  };
  return { root, project };
}

function missingModuleCluster(symbol: string, file?: string) {
  const diag = {
    id: "1",
    source: "typescript" as const,
    severity: "error" as const,
    category: "missing-module" as const,
    message: `Cannot find module '${symbol}'.`,
    raw: `error TS2307: Cannot find module '${symbol}'.`,
    symbol,
    file,
  };
  return {
    category: "missing-module" as const,
    diagnostics: [diag],
    anchor: diag,
  };
}

describe("rankOriginCandidates – tsconfig path aliases", () => {
  it('resolves "@/lib/auth" via tsconfig "@/*": ["src/*"] to src/lib/auth.ts', () => {
    const { root, project } = setupTsconfigProject({
      compilerOptions: { paths: { "@/*": ["src/*"] } },
    });
    writeFile(path.join(root, "src", "lib", "auth.ts"), "export const auth = true;\n");

    const candidates = rankOriginCandidates(missingModuleCluster("@/lib/auth"), root, project, { maxFiles: 2000 });

    const match = candidates.find((c) => c.file === "src/lib/auth.ts");
    expect(match).toBeDefined();
    expect(match?.reasons).toContain("tsconfig path alias candidate");
  });

  it('resolves "@lib/auth" via tsconfig "@lib/*": ["src/lib/*"] to src/lib/auth.ts', () => {
    const { root, project } = setupTsconfigProject({
      compilerOptions: { paths: { "@lib/*": ["src/lib/*"] } },
    });
    writeFile(path.join(root, "src", "lib", "auth.ts"), "export const auth = true;\n");

    const candidates = rankOriginCandidates(missingModuleCluster("@lib/auth"), root, project, { maxFiles: 2000 });

    const match = candidates.find((c) => c.file === "src/lib/auth.ts");
    expect(match).toBeDefined();
    expect(match?.reasons).toContain("tsconfig path alias candidate");
  });

  it('falls back to "exact missing module path candidate" when tsconfig has no paths', () => {
    const { root, project } = setupTsconfigProject({});
    writeFile(path.join(root, "src", "lib", "auth.ts"), "export const auth = true;\n");

    const candidates = rankOriginCandidates(missingModuleCluster("@/lib/auth"), root, project, { maxFiles: 2000 });

    const match = candidates.find((c) => c.file === "src/lib/auth.ts");
    expect(match).toBeDefined();
    expect(match?.reasons).toContain("exact missing module path candidate");
  });

  it("resolves index file candidate: src/lib/auth/index.ts", () => {
    const { root, project } = setupTsconfigProject({
      compilerOptions: { paths: { "@/*": ["src/*"] } },
    });
    writeFile(path.join(root, "src", "lib", "auth", "index.ts"), "export const auth = true;\n");

    const candidates = rankOriginCandidates(missingModuleCluster("@/lib/auth"), root, project, { maxFiles: 2000 });

    const match = candidates.find((c) => c.file === "src/lib/auth/index.ts");
    expect(match).toBeDefined();
    expect(match?.reasons).toContain("tsconfig path alias candidate");
  });

  it("does not throw when tsconfig is invalid JSON", () => {
    const root = tmpDir();
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "tsconfig.json"), "{ invalid }");
    writeJson(path.join(root, "package.json"), {});
    writeFile(path.join(root, "src", "lib", "auth.ts"), "export const auth = true;\n");

    const project: ProjectInfo = {
      root,
      packageJsonPath: path.join(root, "package.json"),
      packageManager: "npm",
      hasTsconfig: true,
      tsconfigPath: path.join(root, "tsconfig.json"),
      hasEslintConfig: false,
      scripts: {},
      git: { isRepo: false, changedFiles: [] },
    };

    expect(() =>
      rankOriginCandidates(missingModuleCluster("@/lib/auth"), root, project, { maxFiles: 2000 }),
    ).not.toThrow();
  });
});
