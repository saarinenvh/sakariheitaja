import { CommandGroup } from "../types";
import { cheer, drawScorekeeper } from "./games";
import { cancelGamePlan, joinGamePlan, leaveGamePlan, listGamePlans, makeGamePlan } from "./planning";

export const gameCommands: CommandGroup = {
  title: "Ja muuta hauskaa mitä hommailen:",
  commands: [
    { name: "kukakirjaa", handle: drawScorekeeper,
      help: [{ usage: "/kukakirjaa [Pelaajien nimet välimerkein eroteltuna]", description: "Arvon kirjaajan annetuista vaihtoehdoista." }] },
    { name: "hyva", handle: cheer, help: [{ usage: "/hyva", description: "Kyl te tiiätte! XD" }] },
    { name: "hep", handle: makeGamePlan,
      help: [{ usage: "/hep [päivä] [klo] [rata + rata]", description: "Suunnittele peli, esim. /hep la 18 Keljo. Ilman päivää tänään." }] },
    { name: "pelei", handle: listGamePlans, help: [{ usage: "/pelei", description: "Listaa tämän ryhmän tulevat pelit." }] },
    { name: "mukaan", handle: joinGamePlan,
      help: [{ usage: "/mukaan [nro] [nimi]", description: "Lähde mukaan peliin, tai lisää joku nimellä." }] },
    { name: "pois", handle: leaveGamePlan,
      help: [{ usage: "/pois [nro] [nimi]", description: "Jää pois pelistä, tai poista joku nimellä." }] },
    { name: "peru", handle: cancelGamePlan, help: [{ usage: "/peru [nro]", description: "Peru tekemäsi peli." }] },
  ],
};
