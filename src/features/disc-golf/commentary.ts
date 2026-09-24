import { getRandom } from "../../shared/utils";
import { Change, MetrixHoleResult, MetrixPlayerResult, TrackedPlayer } from "../../types/metrix";
import { generateLlmComment } from "./llmCommentary";

const llmEnabled = process.env.LLM_ENABLED === "true";

function getPositionDeltaText(prev: number, next: number): string {
  const delta = prev - next;
  if (delta === 0) return "";
  if (delta > 0) return delta === 1 ? ", kipusi sijan ylös" : `, nousi ${delta} sijaa`;
  return Math.abs(delta) === 1 ? ", putosi sijan" : `, putosi ${Math.abs(delta)} sijaa`;
}

// `results` MUST already be narrowed to the player's own division - see
// divisionResultsFor below. Metrix returns one OrderNumber === 1 per division,
// so on an unfiltered array both the `find` and the `filter` here silently pick
// up other divisions' leaders.
function getCompetitionContextSuffix(player: MetrixPlayerResult, results: MetrixPlayerResult[]): string {
  const leader = results.find(r => r.OrderNumber === 1);
  if (!leader) return "";

  if (player.OrderNumber === 1) {
    const tiedAtTop = results.filter(r => r.OrderNumber === 1).length > 1;
    return tiedAtTop ? " – tasatilanteessa johdossa!" : " – ja JOHTAA KISAA!";
  }

  const gap = player.Diff - leader.Diff;
  if (gap === 0) return " – tasatilanteessa johdosta!";
  if (player.OrderNumber <= 3 && gap <= 2) return ` – vain ${gap} takana johtajasta`;
  return "";
}

const narratives = [
  "Ihmiset ovat suorittaneet firsbeegolf heittoja!",
  "Jahas ja tilannekatsauksen aika!",
  "HOI! Nyt taas tapahtuu!",
  "HUOMIO!",
  "Ja taas mennään!",
  "HEIHEIHEI, joku teki jotain!",
  "Tulostaulussa liikehdintää!",
  "Ja taas on väyliä saatettu loppuun.",
];

type ScoreType = "ace" | "albatross" | "eagle" | "birdie" | "par" | "bogey" | "doubleBogey" | "worse";

export const scoreTexts: Record<Exclude<ScoreType, "worse">, string[]> = {
  ace:         ["ÄSSÄN!"],
  eagle:       ["eaglen?? SIIS EAGLEN! En usko", "KOTKAN", "EAGLEN"],
  albatross:   ["ALBATROSSIN?? Salee merkkausvirhe"],
  birdie:      ["birdien", "lintusen", "tirpan", "vitunmoisen tuuripörön", "pörön", "hemmetin kauniin pirkon", "pirkon"],
  par:         ["parin", "PROFESSIONAL AVERAGEN", "ihannetuloksen", "hemmetin tylsän paarin", "tuuripaarin", "scramblepaarin", "tsägällä paarin", "taitopaarin"],
  bogey:       ["bogin", "boggelin", "turhan bogin", "ruskean boggelin"],
  doubleBogey: ["ruman tuplabogin", "tsägällä tuplan", "kaks päälle", "DOUBLE BOGEYN"],
};

export const startTexts = {
  good: [
    "MAHTAVA SUORITUS!", "USKOMATON TEKO!", "ENNENÄKEMÄTÖNTÄ TOIMINTAA!",
    "Wouuuuu, kyllä nyt kelpaa!", "Mahtavaa peliä, ei voi muuta sanoa.",
    "Siis huhu, aika huikeeta!", "Tää dude on iha samaa tasoo ku pauli tai riki!",
    "Kyllä nyt ollaan sankareita!", "WOUUUUU!",
    "Hellurei hellurei vääntö on hurjaa!", "No nyt taas! Näin sen kuuluukin mennä!",
    "Olikohan vahinko, ei tämmöstä yleensä nähä!",
    "JUMALISTE! Oiskohan sittenki vielä sauma mitaleille!",
    "Tämmöstä! Tämmöstä sen olla pitää!", "Nyt ollaa jo lähellä tonninmiehen tasoa!",
    "JA MAALILAITE RÄJÄHTÄÄ!!", "Täällä taas nostellaan häränsilmästä limppuja!",
  ],
  bad: [
    "Voi surkujen surku!", "Voi kyynelten kyynel!", "No ohan tää vähän vaikee laji!",
    "Saatana vois tää spede vaik denffata.", "Kannattiko ees tulla näihin kisoihin??",
    "Säälittävää tekemistä taas...", "Naurettavaa toimintaa!", "Miten voi taas pelata näin?",
    "En voi uskoa silmiäni!", "Miten on mahdollista taas?", "Näkivätkö silmäni oikein?",
    "HAHAHAHAHAHA!", "😃😃😃😃😃",
    "Ei vittu, jopa mä oisin pöröttänu ton mut ei... Ei ei ei.", "Ei jumalauta!",
    "Vittu mitä paskaa, ei kiinnosta ees seurata tätä pelii jos taso on tää!!",
    "Siis mee roskii!", "Noh, toivottavasti ens kerralla käy parempi tuuri.",
    "Voi harmi, hyvä yritys oli mutta nyt kävi näin.",
    "Punasta korttiin ja matka kohti uusia pettymyksiä!",
    "PERSE! Tsemppiä nyt saatana!", "HYVÄ VADEE!", "Taso täällä taas ku MA6.",
    "NYT JUMALAUTA, VÄHÄN EES TSEMPPIÄ!", "Haha, emmä tienny et tää on näin paska!",
    "No nyt oli kyllä paskaa tuuria!",
    "Kävipä hyvä tuuri, ois voinu olla nimittäi VIELÄ PASKEMPAA!!",
    "Nyt on kyl taas TUOMIOPÄIVÄ,  ON TUOMIOPÄIVÄ, on KEINOSEN NIMIPÄIVÄ!",
  ],
  neutral: [
    "Onpahan tylsää...", "Nyt kun olisi aika hyökätä, niin mitä hän tekee?",
    "Ei tälläsellä pelillä kyllä mitaleille mennä :X", "Noniin, lisää harmaataa korttiin!",
    "On se ihannetuloskin tulos, kun", "buuuu!", "Ja ei taaskaa mitään yritystä.",
    "Parasta annettiin ja paskaa tehtiin.",
    "Jahas, yhtä surullista tekemistä ku asuminen Vantaalla.",
    "Hienosti! Vaikea väylä, mutta kyllä kelpaa.", "Mitähän tähän sit taas sanois?",
    "Ei huono!", "Joopajoooooo...", "Yrittäisit edes.",
    "Ei tällä paljoa fieldille hävitä!",
    "Noh aika harvat tällä väylällä paremmin heittää.",
    "Tämmösellä väylällä näin paskaa, on kyl surullista.",
    "Melkeen ymmärtäisin, jos ois ees vaikee väylä.",
    "Noh, ehkä seuraavalla väylällä sitten paremmin...",
  ],
};

export const verbs = [
  "otti", "sai", "suoritti", "taisteli", "möyri", "heitti", "viskoi",
  "rämisteli", "scrambläsi", "liidätteli", "paiskasi", "nakkeli",
  "sinkosi", "nosti", "lapioi", "viimeisteli",
];

export const descriptions = [" Iha siilon yli ja sit suoraan kuoppaan, perkele!", "Mörrin kautta järveen HAHAHAA", "WHAT THE FUCK RICHARD?????", "Varmasti vuoden kaunein draivi!", "Avas saatana taaksepäin xDDDD", "Bossiki kippas tohon vastaseen", "Keskellä lätäkköä, toivottavasti on sukelluskamat messissä", "Satavarma lost disci"]

const obPhrases = [
  ", oli muuten myös <b>OBOBOB</b>",
  ", eikä pysyny ees väylällä <b>(ob)</b>",
  ", kaiken lisäks <b>OUT OF BOUNDS</b>",
  ", oli muute viel <b>OB</b> HÄHÄHÄHÄHÄ",
];

function pick<T>(arr: T[]): T {
  return arr[getRandom(arr.length)];
}

function addPlusSign(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export function getScoreType(holeResult: MetrixHoleResult): ScoreType {
  const { Result, Diff } = holeResult;
  if (parseInt(Result) === 1) return "ace";
  if (Diff <= -3) return "albatross";
  if (Diff === -2) return "eagle";
  if (Diff === -1) return "birdie";
  if (Diff === 0)  return "par";
  if (Diff === 1)  return "bogey";
  if (Diff === 2)  return "doubleBogey";
  return "worse";
}

function getScoreText(type: ScoreType, holeResult: MetrixHoleResult): string {
  if (type === "worse") return `niin ison scoren, että ei mahdu edes näytölle (${holeResult.Result})`;
  return pick(scoreTexts[type]);
}

function getStartText(type: ScoreType): string {
  if (["ace", "eagle", "albatross", "birdie"].includes(type)) return pick(startTexts.good);
  if (type === "par") return pick(startTexts.neutral);
  return pick(startTexts.bad);
}

export function generateFlavor(change: Change): string {
  const { newPlayer, holeResult } = change;
  const type      = getScoreType(holeResult);
  const startText = getStartText(type);
  const scoreText = getScoreText(type, holeResult);
  const verb      = pick(verbs);
  const obPhrase  = holeResult.PEN > 0 ? pick(obPhrases) : "";
  return `${startText} ${newPlayer.Name} ${verb} ${scoreText}${obPhrase}`;
}

export function generateComment(change: Change, results?: MetrixPlayerResult[]): string {
  const { newPlayer, prevPlayer, holeResult } = change;
  const type          = getScoreType(holeResult);
  const startText     = getStartText(type);
  const scoreText     = getScoreText(type, holeResult);
  const verb          = pick(verbs);
  const obPhrase      = holeResult.PEN > 0 ? pick(obPhrases) : "";
  const positionDelta = getPositionDeltaText(prevPlayer.OrderNumber, newPlayer.OrderNumber);
  const contextSuffix = results ? getCompetitionContextSuffix(newPlayer, results) : "";

  const meta = `${newPlayer.Name} | ${scoreText} | ${addPlusSign(newPlayer.Diff)} | sija ${newPlayer.OrderNumber}`;
  return (
    `${startText} <b>${newPlayer.Name}</b> ${verb} ${scoreText}${obPhrase}${positionDelta}${contextSuffix}` +
    `\n<blockquote>${meta}</blockquote>`
  );
}

export function generateHeader(): string {
  return pick(narratives);
}

export function truncateCourseName(rawName: string): string {
  const name = rawName.replace(/&rarr;/g, "");
  return name.length > 38 ? `${name.slice(0, 37)}...` : name;
}

// A competition's Results contain every division at once, and standings context
// - who leads, how far back you are, whether you just took the lead - is only
// meaningful inside your own division. Passing the raw array meant an MA3
// player was measured against the MPO winner: "vain 2 takana johtajasta" where
// the johtaja was in a different competition entirely, and a division leader
// was reported as sharing the lead simply because another division also had an
// OrderNumber === 1.
function divisionResultsFor(change: Change, results: MetrixPlayerResult[]): MetrixPlayerResult[] {
  const division = change.newPlayer.ClassName;
  const withinDivision = results.filter(r => r.ClassName === division);
  // Fall back to the full field rather than an empty context if a competition
  // carries no usable ClassName at all (some older Metrix events).
  return withinDivision.length > 0 ? withinDivision : results;
}

export async function formatCommentaryMessage(changes: Change[], metrixId: string, courseName: string, results: MetrixPlayerResult[], chatId: number): Promise<string> {
  const comments: string[] = [];
  for (const change of changes) {
    const divisionResults = divisionResultsFor(change, results);
    comments.push(llmEnabled
      ? await generateLlmComment(change, metrixId, divisionResults, chatId)
      : generateComment(change, divisionResults));
  }

  const byHole: Record<number, string[]> = {};
  changes.forEach((change, i) => {
    if (!byHole[change.hole]) byHole[change.hole] = [];
    byHole[change.hole].push(comments[i]);
  });

  let message = `${generateHeader()}\n`;
  for (const hole of Object.keys(byHole)) {
    const holeChanges = changes.filter(c => c.hole === parseInt(hole));
    const isStarframe = holeChanges.length > 1 && holeChanges.every(c => c.holeResult.Diff <= -1);

    const holeHeader = `⛳ Väylä ${parseInt(hole) + 1} · <a href="https://discgolfmetrix.com/${metrixId}">${truncateCourseName(courseName)}</a>`;
    message += `\n${holeHeader}\n`;
    if (isStarframe) message += `⭐ STARFRAME ⭐\n`;
    message += `\n`;
    for (const line of byHole[parseInt(hole)]) {
      message += `${line}\n\n`;
    }
  }
  return message;
}

export function formatTopList(competitionName: string, results: MetrixPlayerResult[], trackedPlayers: TrackedPlayer[]): string {
  const divisions = [...new Set(results.map(r => r.ClassName))];
  const rankings: Record<string, MetrixPlayerResult[]> = {};

  for (const division of divisions) {
    rankings[division] = results
      .filter(r => r.ClassName === division && r.OrderNumber <= 5)
      .sort((a, b) => a.OrderNumber - b.OrderNumber);
  }

  // Tracked players outside their division's top 5, grouped so that players
  // from different divisions don't read as one ranking - sorting purely by
  // OrderNumber put an MA3 6th place above an MPO 8th as though they were
  // competing against each other, with nothing on the line to say otherwise.
  const OTHERS = "Muut Sankarit";
  const outsideTopFive = trackedPlayers.filter(player => player.OrderNumber > 5);
  if (outsideTopFive.length) {
    rankings[OTHERS] = [...outsideTopFive].sort(
      (a, b) => a.ClassName.localeCompare(b.ClassName) || a.OrderNumber - b.OrderNumber,
    );
  }

  let message = `${competitionName} TOP-5\n\n`;
  for (const [division, players] of Object.entries(rankings)) {
    message += `Sarja ${division}\n`;
    for (const player of players) {
      const suffix = division === OTHERS ? ` (${player.ClassName})` : "";
      message += `${player.OrderNumber}. ${player.Name}${suffix}\t\t\t\t${player.Diff}\n`;
    }
    message += "\n";
  }
  return message;
}
