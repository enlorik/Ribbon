import path from "node:path";
import type { ProjectInfo } from "../core/types.js";
import { detectPackageManager } from "./detectPackageManager.js";
import { detectGitSignals } from "./gitSignals.js";
import { fileExists, readJsonFile } from "../utils/fs.js";
import { resolveRoot } from "../utils/paths.js";

interface PackageJsonLike {
  scripts?: Record<string, string>;
  eslintConfig?: unknown;
}

const ESLINT_CONFIG_CANDIDATES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yml",
  ".eslintrc.yaml",
];

export async function detectProject(rootArg?: string): Promise<ProjectInfo> {
  const root = resolveRoot(rootArg);
  const packageJsonPath = path.join(root, "package.json");
  const hasPackageJson = fileExists(packageJsonPath);
  const packageJson = hasPackageJson ? readJsonFile<PackageJsonLike>(packageJsonPath) : undefined;

  const tsconfigPath = path.join(root, "tsconfig.json");
  const hasTsconfig = fileExists(tsconfigPath);

  let eslintConfigPath: string | undefined;
  for (const candidate of ESLINT_CONFIG_CANDIDATES) {
    const candidatePath = path.join(root, candidate);
    if (fileExists(candidatePath)) {
      eslintConfigPath = candidatePath;
      break;
    }
  }

  const hasEslintConfig = Boolean(eslintConfigPath) || Boolean(packageJson?.eslintConfig);
  const packageManager = detectPackageManager(root, hasPackageJson);
  const git = await detectGitSignals(root);

  const project: ProjectInfo = {
    root,
    packageManager: packageManager.packageManager,
    hasTsconfig,
    hasEslintConfig,
    scripts: packageJson?.scripts ?? {},
    git,
  };
  if (hasPackageJson) project.packageJsonPath = packageJsonPath;
  if (packageManager.lockfile) project.lockfile = packageManager.lockfile;
  if (hasTsconfig) project.tsconfigPath = tsconfigPath;
  if (eslintConfigPath) project.eslintConfigPath = eslintConfigPath;
  return project;
}
