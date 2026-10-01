/** Maps full Metrix names to capitalized first names, keeping full names where first names collide. */
export function buildSpokenNames(fullNames: readonly string[]): ReadonlyMap<string, string> {
  const uniqueNames = [...new Set(fullNames)];
  const firstNameCounts = new Map<string, number>();
  for (const fullName of uniqueNames) {
    const key = firstName(fullName).toLocaleLowerCase("fi");
    firstNameCounts.set(key, (firstNameCounts.get(key) ?? 0) + 1);
  }
  const spokenNames = new Map<string, string>();
  for (const fullName of uniqueNames) {
    const first = firstName(fullName);
    const isUnique = firstNameCounts.get(first.toLocaleLowerCase("fi")) === 1;
    spokenNames.set(fullName, isUnique ? capitalize(first) : fullName);
  }
  return spokenNames;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function capitalize(name: string): string {
  return name.charAt(0).toLocaleUpperCase("fi") + name.slice(1);
}
