// Dev tool, not shipped app code: fetches a public Metrix round and stores it as an anonymized
// commentary fixture. Usage:
//   npm run eval:commentary:fixture -- --round=3628927 --track="Name A,Name B" --name=harkalinna-top4
import { buildAnonymizedFixture } from "./anonymize";
import { saveFixture } from "./fixtureFile";
import { parseFlags, requireFlag } from "./cliFlags";

const METRIX_RESULT_URL = "https://discgolfmetrix.com/api.php?content=result&id=";

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const roundId = requireFlag(flags, "round");
  const name = requireFlag(flags, "name");
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("--name must be lowercase letters, digits and hyphens");
  const trackedRealNames = requireFlag(flags, "track").split(",").map(value => value.trim()).filter(Boolean);
  const description = flags.get("description") ?? "Real Metrix round, all player names anonymized.";

  const response = await fetch(`${METRIX_RESULT_URL}${encodeURIComponent(roundId)}`);
  if (!response.ok) throw new Error(`Metrix HTTP ${response.status}`);
  const fixture = buildAnonymizedFixture(await response.json(), { name, description, trackedRealNames });
  const path = saveFixture(fixture);
  console.log(`Saved ${path}`);
  console.log(`Tracked players: ${fixture.tracked.join(", ")}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
