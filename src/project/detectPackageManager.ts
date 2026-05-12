import path from "node:path";
import { fileExists } from "../utils/fs.js";
import type { ProjectInfo } from "../core/types.js";

export function detectPackageManager(root: string, hasPackageJson: boolean): Pick<ProjectInfo, "packageManager" | "lockfile"> {
  const checks: Array<{ lockfile: string; manager: ProjectInfo["packageManager"] }> = [
    { lockfile: "pnpm-lock.yaml", manager: "pnpm" },
    { lockfile: "yarn.lock", manager: "yarn" },
    { lockfile: "package-lock.json", manager: "npm" },
    { lockfile: "bun.lockb", manager: "bun" },
    { lockfile: "bun.lock", manager: "bun" },
  ];

  for (const check of checks) {
    const fullPath = path.join(root, check.lockfile);
    if (fileExists(fullPath)) {
      return { packageManager: check.manager, lockfile: check.lockfile };
    }
  }

  return hasPackageJson ? { packageManager: "npm" } : { packageManager: "unknown" };
}
