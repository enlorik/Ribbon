import { execa } from "execa";
import type { GitSignals } from "../core/types.js";

export async function detectGitSignals(root: string): Promise<GitSignals> {
  const check = await execa("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: root,
    reject: false,
  });

  if (check.exitCode !== 0) {
    return { isRepo: false, changedFiles: [] };
  }

  const status = await execa("git", ["status", "--porcelain"], {
    cwd: root,
    reject: false,
  });

  const changedFiles = status.stdout
    .split(/\r?\n/)
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  return { isRepo: true, changedFiles };
}
