import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { clusterCauseRibbons } from "../src/core/cluster.js";
import { parseTsc } from "../src/parsers/parseTsc.js";
import { detectProject } from "../src/project/detectProject.js";

function makeFixtureProject(): string {
  const root = path.join(
    os.tmpdir(),
    `ribbon-fixture-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(path.join(root, "src", "types"), { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture-project", version: "1.0.0" }),
  );
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, target: "ES2022" } }),
  );
  writeFileSync(
    path.join(root, "src", "types", "user.ts"),
    "export interface User { id: string }\n",
  );
  writeFileSync(
    path.join(root, "src", "Profile.tsx"),
    [
      "import type { User } from './types/user.js';",
      "export function Profile({ user }: { user: User }) {",
      "  return user.name;",
      "}",
    ].join("\n"),
  );
  return root;
}

const TS2339_OUTPUT =
  "src/Profile.tsx(3,15): error TS2339: Property 'name' does not exist on type 'User'.";

describe("fixture: TS2339 User.name pipeline", () => {
  it("cluster title is Missing property: User.name", async () => {
    const root = makeFixtureProject();
    const project = await detectProject(root);
    const diagnostics = parseTsc(TS2339_OUTPUT);
    const clusters = clusterCauseRibbons(diagnostics, project, 200);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(clusters[0]!.title).toBe("Missing property: User.name");
  });

  it("top origin candidate is src/types/user.ts", async () => {
    const root = makeFixtureProject();
    const project = await detectProject(root);
    const diagnostics = parseTsc(TS2339_OUTPUT);
    const clusters = clusterCauseRibbons(diagnostics, project, 200);
    const topOrigin = clusters[0]!.originCandidates[0]?.file ?? "";
    expect(topOrigin).toMatch(/src[/\\]types[/\\]user\.ts$/);
  });

  it("evidence contains TS2339", async () => {
    const root = makeFixtureProject();
    const project = await detectProject(root);
    const diagnostics = parseTsc(TS2339_OUTPUT);
    const clusters = clusterCauseRibbons(diagnostics, project, 200);
    expect(clusters[0]!.evidence).toContain("TS2339");
  });

  it("results are deterministic across two runs", async () => {
    const root = makeFixtureProject();
    const project = await detectProject(root);
    const diagnostics = parseTsc(TS2339_OUTPUT);
    const run1 = clusterCauseRibbons(diagnostics, project, 200);
    const run2 = clusterCauseRibbons(diagnostics, project, 200);
    expect(run1[0]!.title).toBe(run2[0]!.title);
    expect(run1[0]!.originCandidates[0]?.file).toBe(run2[0]!.originCandidates[0]?.file);
  });
});
