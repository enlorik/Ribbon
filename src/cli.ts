#!/usr/bin/env node

import { Command } from "commander";
import { runCheck } from "./commands/check.js";
import { runDoctor } from "./commands/doctor.js";
import { runPipe } from "./commands/pipe.js";

const program = new Command();

program
  .name("ribbon")
  .description("Ribbon turns error storms into cause ribbons.")
  .showHelpAfterError();

program
  .command("check")
  .description("Run project diagnostics and cluster them into cause ribbons")
  .option("--root <path>", "Project root. Default cwd.")
  .option("--json", "Print JSON only")
  .option("--demo", "Use demo diagnostics; do not run tools")
  .option("--ts", "Run only TypeScript checker")
  .option("--eslint", "Run only ESLint")
  .option("--audit", "Include npm audit parser")
  .option("--no-ts", "Disable TypeScript checker")
  .option("--no-eslint", "Disable ESLint")
  .option("--max-files <number>", "Limit file search for origin ranking. Default 2000.")
  .option("--no-color", "Disable terminal color")
  .option("--verbose", "Include tool commands and raw failure notes")
  .action(async (options) => {
    process.exitCode = await runCheck(options);
  });

program
  .command("doctor")
  .description("Print detected project facts")
  .option("--root <path>", "Project root. Default cwd.")
  .action(async (options) => {
    process.exitCode = await runDoctor(options.root);
  });

program
  .command("pipe")
  .description("Parse terminal output from stdin and create cause ribbons")
  .option("--root <path>", "Project root. Default cwd.")
  .option("--tool <tool>", "tsc|eslint|audit|unknown", "unknown")
  .option("--json", "Print JSON only")
  .option("--no-color", "Disable terminal color")
  .option("--verbose", "Include additional details")
  .action(async (options) => {
    process.exitCode = await runPipe(options);
  });

await program.parseAsync(process.argv);
