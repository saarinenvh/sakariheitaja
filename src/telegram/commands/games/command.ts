import { CommandGroup } from "../types";
import { announceTodaysPlan, cheer, cheerIsit, drawScorekeeper, listTodaysPlans } from "./games";

export const gameCommands: CommandGroup = {
  title: "Ja muuta hauskaa mitä hommailen:",
  commands: [
    { name: "kukakirjaa", handle: drawScorekeeper,
      help: [{ usage: "/kukakirjaa [Pelaajien nimet välimerkein eroteltuna]", description: "Arvon kirjaajan annetuista vaihtoehdoista." }] },
    { name: "hyva", handle: cheer, help: [{ usage: "/hyva", description: "Kyl te tiiätte! XD" }] },
    { name: "isit", handle: cheerIsit },
    { name: "hep", handle: announceTodaysPlan,
      help: [{ usage: "/hep [Vapaa muotoinen teksti]", description: "Tähän voi ilmottaa jos on menossa pelaamaan samana päivänä." }] },
    { name: "pelei", handle: listTodaysPlans, help: [{ usage: "/pelei", description: "Listaa kaikki hep huudot." }] },
  ],
};
