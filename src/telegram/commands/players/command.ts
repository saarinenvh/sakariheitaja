import { CommandGroup } from "../types";
import { addPlayer, listPlayers, removePlayer } from "./players";

export const playerCommands: CommandGroup = {
  title: "Seurattavat pelaajat:",
  commands: [
    { name: "lisaa", handle: addPlayer,
      help: [{ usage: "/lisaa [Pelaajan nimi metrixissä]", description: "Lisään kyseisen pelaajan seurattaviin pelaajiin." }] },
    { name: "poista", handle: removePlayer,
      help: [{ usage: "/poista [Pelaajan nimi metrixissä]", description: "Poistan kyseisen pelaajan seurattavista pelaajista." }] },
    { name: "pelaajat", handle: listPlayers,
      help: [{ usage: "/pelaajat", description: "Listaan seurattavat pelaajat." }] },
  ],
};
