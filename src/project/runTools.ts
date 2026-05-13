import { execa } from "execa";
import type { DiagnosticSource, ProjectInfo, ToolRunResult } from "../core/types.js";

/**
 * Run the package manager binary itself (e.g. `npm audit --json`).
 * Use this for commands that ARE the package manager, not local project binaries.
 */
export async function runPackageManagerCommand(
  project: ProjectInfo,
  tool: DiagnosticSource,
  args: string[],
): Promise<ToolRunResult> {
  const command = packageManagerBin(project.packageManager);

  try {
    const result = await execa(command, args, {
      cwd: project.root,
      reject: false,
      all: true,
    });

    return {
      tool,
      command,
      args,
      exitCode: result.exitCode ?? null,
      stdout: result.stdout,
      stderr: result.stderr,
      all: result.all ?? `${result.stdout}\n${result.stderr}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("enoent") || message.toLowerCase().includes("not found")) {
      return {
        tool,
        command,
        args,
        exitCode: null,
        stdout: "",
        stderr: "",
        all: "",
        skipped: true,
        skipReason: `${command} is not available`,
      };
    }

    return {
      tool,
      command,
      args,
      exitCode: null,
      stdout: "",
      stderr: message,
      all: message,
      skipped: true,
      skipReason: `${command} failed to start`,
    };
  }
}

function packageManagerBin(manager: ProjectInfo["packageManager"]): string {
  switch (manager) {
    case "pnpm":
      return "pnpm";
    case "yarn":
      return "yarn";
    case "bun":
      return "bun";
    case "npm":
    case "unknown":
    default:
      return "npm";
  }
}

export async function runLocalTool(
  project: ProjectInfo,
  tool: DiagnosticSource,
  binName: string,
  args: string[],
): Promise<ToolRunResult> {
  const commandSpec = commandForPackageManager(project.packageManager, binName, args);

  try {
    const result = await execa(commandSpec.command, commandSpec.args, {
      cwd: project.root,
      reject: false,
      all: true,
    });

    return {
      tool,
      command: commandSpec.command,
      args: commandSpec.args,
      exitCode: result.exitCode ?? null,
      stdout: result.stdout,
      stderr: result.stderr,
      all: result.all ?? `${result.stdout}\n${result.stderr}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("enoent") || message.toLowerCase().includes("not found")) {
      return {
        tool,
        command: commandSpec.command,
        args: commandSpec.args,
        exitCode: null,
        stdout: "",
        stderr: "",
        all: "",
        skipped: true,
        skipReason: `${binName} is not available for ${project.packageManager}`,
      };
    }

    return {
      tool,
      command: commandSpec.command,
      args: commandSpec.args,
      exitCode: null,
      stdout: "",
      stderr: message,
      all: message,
      skipped: true,
      skipReason: `${binName} failed to start`,
    };
  }
}

function commandForPackageManager(
  manager: ProjectInfo["packageManager"],
  binName: string,
  args: string[],
): { command: string; args: string[] } {
  switch (manager) {
    case "pnpm":
      return { command: "pnpm", args: ["exec", binName, ...args] };
    case "yarn":
      return { command: "yarn", args: [binName, ...args] };
    case "bun":
      return { command: "bunx", args: [binName, ...args] };
    case "npm":
    case "unknown":
    default:
      return { command: "npx", args: ["--no-install", binName, ...args] };
  }
}
