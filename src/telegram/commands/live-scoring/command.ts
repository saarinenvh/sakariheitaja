import { CommandDependencies, CommandGroup } from "../types";
import { follow, listFollowedRounds, showPlayerScore, showTopList, stopFollowing } from "./liveScoring";

export const liveScoringCommands = (deps: CommandDependencies): CommandGroup => ({
  title: "Kilpailua seurailen seuraavasti:",
  commands: [
    { name: "follow", handle: ctx => follow(ctx, deps),
      help: [{ usage: "/follow [metrixId]", description: "Alan seuraamaan kyseistä kisaa ja kommentoin kisan tapahtumia." }] },
    { name: "pelit", handle: listFollowedRounds,
      help: [{ usage: "/pelit", description: "Listaan kisat, joita seuraan nyt." }] },
    { name: "top5", handle: showTopList,
      help: [{ usage: "/top5 [metrixId]", description: "Kerron seurattavan kisan top-5 tilastot sarjoittain." }] },
    { name: "score", handle: showPlayerScore,
      help: [{ usage: "/score [Pelaajan nimi metrixissä]", description: "Kerron kyseisen pelaajan tuloksen ja sijoituksen." }] },
    { name: "lopeta", handle: stopFollowing,
      help: [{ usage: "/lopeta [metrixId]", description: "Lopetan kyseisen kisan seuraamisen." }] },
  ],
});
