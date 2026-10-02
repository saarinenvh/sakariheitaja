import { CommandGroup } from "../types";
import { manageBagtags } from "./bagtags";

export const bagtagCommands: CommandGroup = {
  title: "Bag Tag:",
  commands: [
    { name: "bagtag", handle: manageBagtags, help: [
      { usage: "/bagtag", description: "Näytä bag tag tilanne." },
      { usage: "/bagtag set [nimi] [numero]", description: "Aseta tägi pelaajalle." },
      { usage: "/bagtag remove [nimi]", description: "Poista pelaajan tägi." },
    ] },
  ],
};
