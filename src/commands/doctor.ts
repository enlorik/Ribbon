import { formatDoctorOutput } from "../core/formatOutput.js";
import { detectProject } from "../project/detectProject.js";
import { fileExists, readJsonFile } from "../utils/fs.js";

interface PackageJsonDeps {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function runDoctor(root?: string): Promise<number> {
  const project = await detectProject(root);

  const packageJson = project.packageJsonPath
    ? readJsonFile<PackageJsonDeps>(project.packageJsonPath)
    : undefined;

  const hasTsDependency = hasDependency(packageJson, "typescript") || hasLocalBin(project.root, "tsc");
  const hasEslintDependency = hasDependency(packageJson, "eslint") || hasLocalBin(project.root, "eslint");

  const lines: string[] = [
    `Root: ${project.root}`,
    `Package: ${project.packageJsonPath ? "package.json found" : "package.json not found"}`,
    `Package manager: ${project.packageManager}${project.lockfile ? ` (${project.lockfile})` : ""}`,
    `TypeScript: ${project.hasTsconfig ? "tsconfig.json found" : "tsconfig.json not found"}`,
    `TypeScript tool: ${hasTsDependency ? "dependency/binary detected" : "not detected"}`,
    `ESLint: ${project.hasEslintConfig ? "ESLint config found" : "ESLint config not found"}`,
    `ESLint tool: ${hasEslintDependency ? "dependency/binary detected" : "not detected"}`,
    `Git: ${project.git?.isRepo ? `repo detected, ${project.git.changedFiles.length} changed files` : "not detected"}`,
    "",
    "Scripts:",
  ];

  const scriptEntries = Object.entries(project.scripts);
  if (scriptEntries.length === 0) {
    lines.push("  (none)");
  } else {
    for (const [name, script] of scriptEntries) {
      lines.push(`  ${name.padEnd(7)} ${script}`);
    }
  }

  lines.push("", "Recommended:", "  ribbon check");

  if (!project.hasTsconfig) {
    lines.push("", "No tsconfig.json found; TypeScript check will be skipped.");
  }
  if (!project.hasEslintConfig) {
    lines.push("No ESLint config found; ESLint check will be skipped.");
  }

  process.stdout.write(`${formatDoctorOutput(lines)}\n`);
  return 0;
}

function hasDependency(packageJson: PackageJsonDeps | undefined, name: string): boolean {
  return Boolean(packageJson?.dependencies?.[name] ?? packageJson?.devDependencies?.[name]);
}

function hasLocalBin(root: string, binName: string): boolean {
  return fileExists(`${root}/node_modules/.bin/${binName}`);
}
