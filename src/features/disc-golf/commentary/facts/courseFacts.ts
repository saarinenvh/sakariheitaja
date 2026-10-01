import { RoundPlayer } from "../../metrix/metrixRound";

export interface CourseCoordinates { latitude: number; longitude: number }
export interface CourseRatingAnchors { value1: number; result1: number; value2: number; result2: number }
export interface HoleLayoutFacts { label: string; par: number | null; lengthM: number | null; tee: CourseCoordinates | null; basket: CourseCoordinates | null }
export interface HoleHistoryFacts { label: string; par: number | null; averageStrokes: number | null; difficultyRank: number | null; aces: number | null }

export const MIN_HOLES_WITH_LENGTH_FOR_EXTREMES = 3;
export const MIN_RELEVANT_WIND_MS = 3;
export const MIN_PLAYERS_FOR_FIELD_AVERAGE = 3;

const PRO_RATING_MIN = 1000;
const MA1_RATING_MIN = 935;
const MA2_RATING_MIN = 900;
const DIFFICULTY_CLASSES = [
  { minRating: PRO_RATING_MIN, label: "PRO-taso (erittäin vaativa)" },
  { minRating: MA1_RATING_MIN, label: "MA1-taso (vaativa)" },
  { minRating: MA2_RATING_MIN, label: "MA2-taso (keskitaso)" },
] as const;
const LOWEST_DIFFICULTY_CLASS = "MA3-taso (harrastetaso)";

const FULL_CIRCLE_DEG = 360;
const HALF_CIRCLE_DEG = 180;
const HEAD_OR_TAIL_WIND_SECTOR_HALF_WIDTH_DEG = 45;
const WIND_FROM_RIGHT_CENTRE_DEG = 90;
const WIND_FROM_LEFT_CENTRE_DEG = 270;

const DISPLAY_DECIMAL_FACTOR = 10;

/** Metrix course rating: linear interpolation through the two anchor (rating, strokes) points. */
export function computeRating(anchors: CourseRatingAnchors, totalStrokes: number): number | null {
  const { value1, result1, value2, result2 } = anchors;
  if (![value1, result1, value2, result2, totalStrokes].every(Number.isFinite)) return null;
  if (result1 === result2) return null;
  const rating = (value2 - value1) * (totalStrokes - result1) / (result2 - result1) + value1;
  return Number.isFinite(rating) ? Math.round(rating) : null;
}

export function describeCourseDifficulty(anchors: CourseRatingAnchors | null, coursePar: number | null): string | null {
  if (anchors === null || coursePar === null) return null;
  const parRating = computeRating(anchors, coursePar);
  if (parRating === null) return null;
  return `Radan par-rating noin ${parRating}: ${classifyDifficulty(parRating)}.`;
}

export function describeRoundRating(anchors: CourseRatingAnchors | null, totalStrokes: number | null): string | null {
  if (anchors === null || totalStrokes === null) return null;
  const rating = computeRating(anchors, totalStrokes);
  if (rating === null) return null;
  return `Kierroksen rating noin ${rating}.`;
}

export function describeHoleLength(hole: HoleLayoutFacts, layout: readonly HoleLayoutFacts[]): string | null {
  if (!isKnownLength(hole.lengthM)) return null;
  const parts = [`${Math.round(hole.lengthM)} m`];
  if (hole.par !== null) parts.unshift(`Par ${hole.par}`);
  const extreme = describeLengthExtreme(hole.lengthM, layout);
  if (extreme !== null) parts.push(extreme);
  return `${parts.join(", ")}.`;
}

/** Initial great-circle bearing from tee to basket in degrees, 0 = north, clockwise. */
export function holeBearingDeg(tee: CourseCoordinates, basket: CourseCoordinates): number {
  const teeLatitudeRad = toRadians(tee.latitude);
  const basketLatitudeRad = toRadians(basket.latitude);
  const longitudeDeltaRad = toRadians(basket.longitude - tee.longitude);
  const east = Math.sin(longitudeDeltaRad) * Math.cos(basketLatitudeRad);
  const north = Math.cos(teeLatitudeRad) * Math.sin(basketLatitudeRad)
    - Math.sin(teeLatitudeRad) * Math.cos(basketLatitudeRad) * Math.cos(longitudeDeltaRad);
  return normalizeDegrees(toDegrees(Math.atan2(east, north)));
}

/** `windFromDeg` follows the meteorological convention: the direction the wind blows from. */
export function describeWindOnHole(hole: HoleLayoutFacts, windFromDeg: number | null, windSpeedMs: number | null): string | null {
  if (hole.tee === null || hole.basket === null) return null;
  if (windFromDeg === null || windSpeedMs === null) return null;
  if (!Number.isFinite(windFromDeg) || !Number.isFinite(windSpeedMs)) return null;
  if (windSpeedMs < MIN_RELEVANT_WIND_MS) return null;
  const relativeDeg = normalizeDegrees(windFromDeg - holeBearingDeg(hole.tee, hole.basket));
  return `${classifyRelativeWind(relativeDeg)} ${formatDecimal(windSpeedMs)} m/s.`;
}

export function describeHoleHistory(hole: HoleHistoryFacts, holeCount: number): string | null {
  const parts = [describeDifficultyRank(hole.difficultyRank, holeCount), describeAverage(hole)]
    .filter(part => part !== null);
  if (parts.length === 0) return null;
  const sentence = parts.join(", ");
  const aces = describeAces(hole.aces);
  const withAces = aces === null ? sentence : `${sentence}; ${aces}`;
  return `${capitalize(withAces)}.`;
}

export function describeTodayFieldAverage(players: readonly RoundPlayer[], holeIndex: number): string | null {
  const strokes = collectFieldStrokes(players, holeIndex);
  if (strokes.length < MIN_PLAYERS_FOR_FIELD_AVERAGE) return null;
  const average = strokes.reduce((sum, value) => sum + value, 0) / strokes.length;
  return `Tänään kentän keskiarvo väylällä ${formatDecimal(average)} heittoa (${strokes.length} pelaajaa).`;
}

function classifyDifficulty(rating: number): string {
  for (const difficultyClass of DIFFICULTY_CLASSES) {
    if (rating >= difficultyClass.minRating) return difficultyClass.label;
  }
  return LOWEST_DIFFICULTY_CLASS;
}

function isKnownLength(lengthM: number | null): lengthM is number {
  return lengthM !== null && Number.isFinite(lengthM) && lengthM > 0;
}

function describeLengthExtreme(lengthM: number, layout: readonly HoleLayoutFacts[]): string | null {
  const lengths = layout.map(hole => hole.lengthM).filter(isKnownLength);
  if (lengths.length < MIN_HOLES_WITH_LENGTH_FOR_EXTREMES) return null;
  const isUnique = lengths.filter(length => length === lengthM).length === 1;
  if (!isUnique) return null;
  if (lengthM === Math.min(...lengths)) return "radan lyhyin";
  if (lengthM === Math.max(...lengths)) return "radan pisin";
  return null;
}

function classifyRelativeWind(relativeDeg: number): string {
  if (angularDistance(relativeDeg, 0) <= HEAD_OR_TAIL_WIND_SECTOR_HALF_WIDTH_DEG) return "Vastatuuli";
  if (angularDistance(relativeDeg, HALF_CIRCLE_DEG) <= HEAD_OR_TAIL_WIND_SECTOR_HALF_WIDTH_DEG) return "Myötätuuli";
  const isFromRight = angularDistance(relativeDeg, WIND_FROM_RIGHT_CENTRE_DEG)
    < angularDistance(relativeDeg, WIND_FROM_LEFT_CENTRE_DEG);
  return isFromRight ? "Sivutuuli oikealta" : "Sivutuuli vasemmalta";
}

function describeDifficultyRank(difficultyRank: number | null, holeCount: number): string | null {
  if (difficultyRank === null || !Number.isInteger(difficultyRank) || !Number.isInteger(holeCount)) return null;
  if (difficultyRank < 1 || difficultyRank > holeCount) return null;
  // Metrix ranks 1 = easiest; commentary speaks in terms of hardness.
  const hardnessPosition = holeCount - difficultyRank + 1;
  if (hardnessPosition === 1) return "radan vaikein väylä";
  if (hardnessPosition === holeCount) return "radan helpoin väylä";
  return `radan ${hardnessPosition}. vaikein väylä`;
}

function describeAverage(hole: HoleHistoryFacts): string | null {
  if (hole.averageStrokes === null || !Number.isFinite(hole.averageStrokes) || hole.averageStrokes <= 0) return null;
  const average = `historiallinen keskiarvo ${formatDecimal(hole.averageStrokes)} heittoa`;
  return hole.par === null ? average : `${average} (par ${hole.par})`;
}

function describeAces(aces: number | null): string | null {
  if (aces === null || !Number.isInteger(aces) || aces <= 0) return null;
  return aces === 1 ? "väylällä tehty 1 ässä" : `väylällä tehty ${aces} ässää`;
}

function collectFieldStrokes(players: readonly RoundPlayer[], holeIndex: number): number[] {
  const strokes: number[] = [];
  for (const player of players) {
    if (player.round.status === "dnf" || player.scorecard.kind !== "available") continue;
    const score = player.scorecard.holes[holeIndex];
    if (score === undefined || score === null) continue;
    strokes.push(score.strokes);
  }
  return strokes;
}

function angularDistance(firstDeg: number, secondDeg: number): number {
  const difference = normalizeDegrees(firstDeg - secondDeg);
  return Math.min(difference, FULL_CIRCLE_DEG - difference);
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % FULL_CIRCLE_DEG) + FULL_CIRCLE_DEG) % FULL_CIRCLE_DEG;
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / HALF_CIRCLE_DEG;
}

function toDegrees(radians: number): number {
  return radians * HALF_CIRCLE_DEG / Math.PI;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDecimal(value: number): string {
  const rounded = Math.round(value * DISPLAY_DECIMAL_FACTOR) / DISPLAY_DECIMAL_FACTOR;
  return String(rounded || 0).replace(".", ",");
}
