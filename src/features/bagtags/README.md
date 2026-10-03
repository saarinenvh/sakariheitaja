# Bagtags

Each chat's bag tags: who holds which number. At a round end the tracked players who played swap
tags by their results, and the chat gets the announcement.

## Entry points

| Entry point | Called by |
| --- | --- |
| `setBagtag`, `removeBagtag`, `getAllBagtags` | `/bagtag` (`telegram/commands/bagtags/`) |
| `computeAndApplySwaps`, `selectBagtagParticipants` | `finishRound` (`../live-scoring/roundFinalizer.ts`) |
| `getMissingTagPlayers` | the live-scoring player announcement |

## Data

Stored in `bagtags.json` in `DATA_DIR`, not in the database (see `docs/architecture/data.md`).
Where bagtags belong for good is ticket EfY0S63X.

## Files

| File | Does |
| --- | --- |
| `bagtags.ts` | The store: reads and writes the tags, applies a round's swaps. |
| `policy.ts` | The swap rule: within a group, tag holders get their tags back in result order, DNF players last. |
| `messages.ts` | The round-end announcement and the `/bagtag` list. |
