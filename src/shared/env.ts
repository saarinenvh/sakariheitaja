// Blank is not the same as unset.
//
// docker-compose substitutes an unset variable as an empty string, so
// `process.env.X` arrives as "" rather than undefined - and `"" ?? fallback`
// evaluates to "", not the fallback. parseInt("") is NaN, and setTimeout with
// a NaN delay fires immediately, which for the poller would mean hammering
// Metrix in a tight loop instead of polling every 30 seconds.
export function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}
