import { mkdirSync, readdirSync } from "fs";
import { join } from "path";

const RUN_DIR_PREFIX = "run";

/** Creates and returns the next free `runN/` folder in `outDir`, so no eval run overwrites another. */
export function createRunDirectory(outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const directory = join(outDir, `${RUN_DIR_PREFIX}${nextRunNumber(outDir)}`);
  mkdirSync(directory);
  return directory;
}

function nextRunNumber(outDir: string): number {
  const numbers = readdirSync(outDir)
    .map(entry => new RegExp(`^${RUN_DIR_PREFIX}(\\d+)$`).exec(entry))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(match => Number(match[1]));
  return Math.max(0, ...numbers) + 1;
}
