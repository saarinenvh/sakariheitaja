/** Parses `--key=value` arguments; bare `--key` becomes an empty string. */
export function parseFlags(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const argument of argv) {
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument "${argument}"; use --key=value`);
    const separator = argument.indexOf("=");
    if (separator === -1) flags.set(argument.slice(2), "");
    else flags.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  return flags;
}

export function requireFlag(flags: ReadonlyMap<string, string>, key: string): string {
  const value = flags.get(key);
  if (!value) throw new Error(`Missing --${key}=<value>`);
  return value;
}

export function parsePositiveIntegerFlag(flags: ReadonlyMap<string, string>, key: string, fallback: number): number {
  const raw = flags.get(key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${key} must be a positive integer, got "${raw}"`);
  return value;
}
