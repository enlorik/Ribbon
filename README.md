# Ribbon

Ribbon is a calm terminal diagnostic tool for TypeScript and JavaScript web projects.

**Core sentence:** Ribbon turns error storms into cause ribbons.

## Why cause ribbons exist

Large projects can produce many downstream errors from one upstream break. Ribbon groups repeated diagnostics into probable root-cause clusters called **cause ribbons**, then ranks likely origin files so you can fix the first thing first.

## Install and development

Requirements: Node.js >= 20

```bash
npm install
npm run build
npm test
```

Run in development mode:

```bash
npm run dev -- check --demo
npm run dev -- doctor
```

## CLI examples

```bash
ribbon check
ribbon check --demo
ribbon check --json
ribbon check --audit
ribbon doctor
```

## Pipe mode

Pipe mode reads diagnostic output from stdin. Structured tool modes (`--tool tsc`, `--tool eslint`, `--tool audit`) are more reliable than unknown mode because they know the exact output format.

```bash
# TypeScript — structured mode (recommended)
npm run build 2>&1 | ribbon pipe --tool tsc

# ESLint — structured mode (recommended)
npx eslint . --format json | ribbon pipe --tool eslint

# npm audit — structured mode (recommended)
npm audit --json | ribbon pipe --tool audit

# Unknown output — falls back to generic parsing
some-command 2>&1 | ribbon pipe
```

## What v1 supports

- Project fact detection (package manager, tsconfig, ESLint config, git changed files)
- Running TypeScript and ESLint checks when available
- Optional npm audit parsing (npm lockfile path only in v1)
- Parsing and normalizing diagnostics into one model
- Deterministic clustering into cause ribbons
- Origin candidate ranking (top files to inspect first)
- Calm terminal output and JSON output mode
- Pipe mode for parsing stdin diagnostics

## What v1 does not support

- Desktop app UI
- Monaco/Tauri integration
- AI-assisted fixes or remote AI calls
- Automatic code modifications
- Full ecosystem audit support for pnpm/yarn/bun

## Example output

```text
Ribbon found 3 cause ribbons tying 42 problems

1. Missing property: User.name
   may explain: 18 TypeScript diagnostics
   origin candidate: src/types/user.ts
   confidence: 90%
   evidence: TS2339; 18 diagnostics; 7 files affected; repeated symbol 'name'
   try first: Check whether the symbol was renamed, moved, or not imported.
```

## Architecture overview

1. Collect tool output
2. Parse tool output
3. Normalize diagnostics
4. Cluster into cause ribbons
5. Rank origin files
6. Print calm output

The core modules are separated from CLI commands so a future desktop app can import the same logic.

## Future plan

- Desktop app
- Monaco underlines
- xterm terminal
- GitHub Actions / CI mode
- Safe fix previews

## CI notes

When a new GitHub Actions workflow is introduced from a pull request for the first time, GitHub may require a maintainer to approve the workflow run before it executes.

## Design notes

**Why fingerprint on symbol identity, not message text** — The string "Property 'name' does not exist on type 'User'" appears in eighteen different files with eighteen different line numbers. The pair `User.name` appears once as a definition. Grouping by type-symbol pair rather than by message or location is what collapses an error storm into a single ribbon pointing at the source.

**Why determinism matters** — Same input produces byte-identical output: buckets are sorted by (file, line), ties are broken with explicit comparators, nothing depends on timestamps or randomness. Practical benefits: snapshot tests require no special mocking, CI diffs don't shift between runs, and a triage tool that reorders itself every run teaches you to ignore it.

**Why definition outranks error location in scoring** — The origin scorer gives +40 to the file that defines a missing type or symbol, and +20 to each file where a diagnostic appears. Those weights encode the real goal: the eighteen error sites are symptoms, and the one file containing `interface User` is where a single edit fixes all of them. Each ranked file carries its reasons — the output is meant to be an argument you can disagree with, not a black-box recommendation.

**Known limits** — Ribbon now uses lightweight static import reachability: definition files reachable from the diagnostic file via `import`/`export` edges score higher than unrelated matches. This is not full TypeScript module resolution — dynamic imports, complex package re-exports, and path mappings beyond tsconfig `paths` remain outside scope. Confidence values (0.9, 0.85, 0.45) are hand-set priors, not calibrated probabilities.
