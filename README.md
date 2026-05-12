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
npm run build 2>&1 | ribbon pipe --tool tsc
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
