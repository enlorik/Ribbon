import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { detectPackageManager } from "../src/project/detectPackageManager.js";

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
