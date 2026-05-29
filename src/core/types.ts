export type DiagnosticSource =
  | "typescript"
  | "eslint"
  | "npm-audit"
  | "test"
  | "pipe"
  | "unknown";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticCategory =
  | "syntax"
  | "type"
  | "missing-symbol"
  | "missing-module"
  | "lint"
  | "security"
  | "test"
  | "config"
  | "runtime"
  | "unknown";

export interface NormalizedDiagnostic {
  id: string;
  source: DiagnosticSource;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  ruleId?: string;
  fixable?: boolean;
  suggestionsCount?: number;
  packageName?: string;
  symbol?: string;
  typeName?: string;
  message: string;
  raw: string;
  toolCommand?: string;
  relatedFiles?: string[];
}

export interface OriginCandidate {
  file: string;
  score: number;
  reasons: string[];
}

export interface CauseCluster {
  id: string;
  title: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  diagnostics: NormalizedDiagnostic[];
  anchor?: NormalizedDiagnostic;
  originCandidates: OriginCandidate[];
  confidence: number;
  suggestedFirstAction: string;
  explanation: string;
  evidence: string[];
}

export interface CheckResult {
  project: ProjectInfo;
  diagnostics: NormalizedDiagnostic[];
  clusters: CauseCluster[];
  toolRuns: ToolRunResult[];
}

export interface ProjectInfo {
  root: string;
  packageJsonPath?: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  lockfile?: string;
  hasTsconfig: boolean;
  tsconfigPath?: string;
  hasEslintConfig: boolean;
  eslintConfigPath?: string;
  scripts: Record<string, string>;
  git?: GitSignals;
}

export interface GitSignals {
  isRepo: boolean;
  changedFiles: string[];
}

export interface ToolRunResult {
  tool: DiagnosticSource;
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  all: string;
  skipped?: boolean;
  skipReason?: string;
}
