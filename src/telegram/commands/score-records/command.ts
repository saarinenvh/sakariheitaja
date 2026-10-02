import { CommandGroup } from "../types";
import { showCourseResults } from "./scoreRecords";

export const scoreRecordCommands: CommandGroup = {
  title: "Tulokset:",
  commands: [
    { name: "tulokset", handle: showCourseResults,
      help: [{ usage: "/tulokset [kentän nimi tai id]", description: "Kerron kentän kymmenen parasta tulosta." }] },
  ],
};
