import { describe, expect, it } from "vitest";
import { readdirSync } from "fs";
import { join, relative, sep } from "path";

// Every module keeps its tests in a tests/ subfolder (sakke-workspace
// .agents/code-style.md, Folder structure), so a test next to the code is a
// layout mistake.
const REPO_DIR = join(__dirname, "..", "..");
const SOURCE_DIRS = ["src", "scripts"];

function findTestFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findTestFiles(path));
    else if (entry.name.endsWith(".test.ts")) found.push(relative(REPO_DIR, path));
  }
  return found;
}

describe("test layout", () => {
  it("keeps every test in a tests/ folder", () => {
    const testFiles = SOURCE_DIRS.flatMap(dir => findTestFiles(join(REPO_DIR, dir)));
    const misplaced = testFiles.filter(path => !path.split(sep).includes("tests"));
    expect(misplaced).toEqual([]);
  });
});
