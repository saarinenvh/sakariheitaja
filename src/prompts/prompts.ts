import { readFileSync } from "fs";
import { join } from "path";

// The .md files next to this module; the build copies them beside the compiled code.

export function loadPrompt(filename: string): string {
  return readFileSync(join(__dirname, filename), "utf-8").trim();
}

/** Context documents joined with separators; a missing one is left out. */
export function loadContext(filenames: string[]): string {
  return filenames
    .map(filename => {
      try {
        return readFileSync(join(__dirname, filename), "utf-8").trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}
