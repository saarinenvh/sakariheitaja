export interface BagtagSwap {
  playerName: string;
  from: number;
  to: number;
}

export interface BagtagRoundResult {
  swaps: BagtagSwap[];
  unchanged: { playerName: string; tag: number }[];
  noTag: string[];
}

/** A tracked player at round end: tags swap within a group, by result, DNF players last. */
export interface BagtagParticipant {
  playerName: string;
  relativeToPar: number | null;
  group: string;
  dnf: boolean;
}

/** The round's swaps and the chat's tags after them. */
export interface BagtagReallocation extends BagtagRoundResult {
  updatedTags: Record<string, number>;
}

/**
 * Within each group, the tag holders get their own tags back in result order: the best result takes
 * the lowest tag. DNF players rank last. A group with fewer than two tag holders swaps nothing.
 */
export function reallocateBagtags(
  chatTags: Readonly<Record<string, number>>, participants: readonly BagtagParticipant[],
): BagtagReallocation {
  const groups = new Map<string, BagtagParticipant[]>();
  for (const player of participants) {
    if (!groups.has(player.group)) groups.set(player.group, []);
    groups.get(player.group)!.push(player);
  }

  const swaps: BagtagSwap[] = [];
  const unchanged: { playerName: string; tag: number }[] = [];
  const noTag: string[] = [];
  const updatedTags = { ...chatTags };

  for (const player of participants) {
    if (chatTags[player.playerName] == null) noTag.push(player.playerName);
  }

  for (const [, groupPlayers] of groups) {
    const tagHolders = groupPlayers.filter(p => chatTags[p.playerName] != null);
    if (tagHolders.length < 2) {
      for (const p of tagHolders) {
        unchanged.push({ playerName: p.playerName, tag: chatTags[p.playerName] });
      }
      continue;
    }

    const sorted = [...tagHolders].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (a.relativeToPar === null || b.relativeToPar === null) return 0;
      return a.relativeToPar - b.relativeToPar;
    });

    const tags = sorted.map(p => chatTags[p.playerName]).sort((a, b) => a - b);

    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i];
      const newTag = tags[i];
      const oldTag = chatTags[player.playerName];
      if (newTag !== oldTag) {
        swaps.push({ playerName: player.playerName, from: oldTag, to: newTag });
        updatedTags[player.playerName] = newTag;
      } else {
        unchanged.push({ playerName: player.playerName, tag: oldTag });
      }
    }
  }

  return { swaps, unchanged, noTag, updatedTags };
}
