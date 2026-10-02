import { CommandGroup } from "../types";

const HELP_INTRO = "Meikää saa käskyttää seuraavin ja vain seuraavin komennoin!";

/** /apua: every group's commands that have help, in registry order. */
export function formatHelp(groups: readonly CommandGroup[]): string {
  const sections = groups.flatMap(group => {
    const lines = group.commands.flatMap(command => (command.help ?? []).map(help => `${help.usage} - ${help.description}`));
    return lines.length > 0 ? [`${group.title}\n${lines.join("\n")}`] : [];
  });
  return [HELP_INTRO, ...sections].join("\n\n");
}
