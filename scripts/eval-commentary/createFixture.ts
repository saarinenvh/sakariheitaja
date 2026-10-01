// Dev tool, not shipped app code: fetches a public Metrix round and stores it as an anonymized
// commentary fixture, with the course's layout data and statistics. Usage:
//   BOT_METRIX_INTEGRATION_CODE=... npm run eval:commentary:fixture -- --round=3628927 --track="Name A,Name B" --name=harkalinna-top4
// Without the integration code the fixture still gets the public course statistics, but no layout data.
import { buildAnonymizedFixture, readCourseId } from "./anonymize";
import { FixtureCourse, saveFixture } from "./fixtureFile";
import { parseCourseDetails } from "../../src/features/disc-golf/metrix/metrixCourse";
import { fetchCourseStatistics } from "../../src/features/disc-golf/metrix/courseStatistics";
import { parseFlags, requireFlag } from "./cliFlags";

const METRIX_RESULT_URL = "https://discgolfmetrix.com/api.php?content=result&id=";
const METRIX_COURSE_URL = "https://discgolfmetrix.com/api.php?content=course&id=";

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const roundId = requireFlag(flags, "round");
  const name = requireFlag(flags, "name");
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("--name must be lowercase letters, digits and hyphens");
  const trackedRealNames = requireFlag(flags, "track").split(",").map(value => value.trim()).filter(Boolean);
  const description = flags.get("description") ?? "Real Metrix round, all player names anonymized.";

  const response = await fetch(`${METRIX_RESULT_URL}${encodeURIComponent(roundId)}`);
  if (!response.ok) throw new Error(`Metrix HTTP ${response.status}`);
  const round: unknown = await response.json();
  const courseId = readCourseId(round);
  const course = courseId ? await fetchFixtureCourse(courseId) : null;
  const fixture = buildAnonymizedFixture(round, { name, description, trackedRealNames, course });
  const path = saveFixture(fixture);
  console.log(`Saved ${path}`);
  console.log(`Course data: layout ${course?.detailsResponse ? "included" : "missing"}, statistics ${course?.statistics ? "included" : "missing"}`);
  console.log(`Tracked players: ${fixture.tracked.join(", ")}`);
}

async function fetchFixtureCourse(courseId: string): Promise<FixtureCourse> {
  const statistics = await fetchCourseStatistics(courseId);
  return {
    courseId,
    detailsResponse: await fetchCourseDetailsResponse(courseId),
    statistics: statistics.kind === "found" ? statistics.statistics : null,
  };
}

/** Keeps Metrix's raw layout response so the eval re-parses it exactly like the bot; the code never leaves this request. */
async function fetchCourseDetailsResponse(courseId: string): Promise<unknown> {
  const code = process.env.BOT_METRIX_INTEGRATION_CODE;
  if (!code) return null;
  const response = await fetch(`${METRIX_COURSE_URL}${encodeURIComponent(courseId)}&code=${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error(`Metrix course API HTTP ${response.status}`);
  const details: unknown = await response.json();
  parseCourseDetails(details, courseId);
  return details;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
