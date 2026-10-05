import { BotCommand, CommandGroup } from "../types";
import { NotableScoreKind } from "../../../features/score-records";
import { showCourseResults } from "./scoreRecords";
import { showSpecialScores } from "./specialScores";
import { SPECIAL_SCORE_WORDS, specialScoreMessages } from "./messages";

const SPECIAL_SCORE_KINDS: readonly NotableScoreKind[] = ["ace", "eagle", "albatross"];

export const scoreRecordCommands: CommandGroup = {
  title: "Tulokset:",
  commands: [
    { name: "tulokset", handle: showCourseResults,
      help: [{ usage: "/tulokset [kentän nimi tai id]", description: "Kerron kentän kymmenen parasta tulosta." }] },
    ...SPECIAL_SCORE_KINDS.map(specialScoreCommand),
  ],
};

function specialScoreCommand(kind: NotableScoreKind): BotCommand {
  const { command, help } = SPECIAL_SCORE_WORDS[kind];
  return { name: command, handle: showSpecialScores(kind), help: [{ usage: specialScoreMessages.usage(command), description: help }] };
}
