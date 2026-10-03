# Live scoring

Follows a Disc Golf Metrix round in a chat: polls the round, hands every change to
`../commentary/`, and runs the round end once every tracked player has finished or is out.
Commentary writes the messages about the play; this feature owns the round's lifecycle around it.

```mermaid
sequenceDiagram
    participant Chat as /follow
    participant Tracker as ScoreTracker
    participant Metrix as MetrixClient
    participant Commentary as RoundCommentary
    participant End as finishRound
    Chat->>Tracker: init()
    Tracker->>Metrix: getRound
    Tracker->>Chat: player announcement
    loop every poll (Poller, intervals from policy.ts)
        Tracker->>Metrix: getRound
        Tracker->>Commentary: observe(round, tracked players)
        Commentary-->>Chat: one message per division update
    end
    Note over Tracker: every tracked player finished or DNF
    Tracker->>Commentary: idle() — last message out first
    Tracker->>End: finishRound
    End->>Chat: end message, TOP-5, bagtags
```

## Entry points

| Entry point | Called by |
| --- | --- |
| `new ScoreTracker(...).init()` (`liveScoring.ts`) | `/follow` (`telegram/commands/live-scoring/`), and `main.ts` at startup for every competition not marked done |
| `registerCompetition` (`liveScoring.ts`) | `/follow`: stores the chat, if new, and the competition |
| `trackerRegistry` | the `/follow`, `/lopeta`, `/pelit`, `/top5` and `/score` handlers |
| `ScoreTracker.sendTopList`, `ScoreTracker.getScoreByPlayerName` | `/top5`, `/score` |
| `db/competitionRepository` | `/follow` (delete when the round can't start), `/lopeta` (delete), `main.ts` (unfinished rounds), `finishRound` (mark done) |

`registerCompetition` also stores the chat through the `chats` feature, in case the bot missed joining it.

## Data

- Owns the `competitions` table (`db/`): a followed round's chat, Metrix id and whether it is done.
- In memory: the rounds each chat follows (`trackerRegistry.ts`), and each round's last snapshot
  and tracked players (`ScoreTracker`). A restart rebuilds them from the unfinished competitions.

## Behaviour

- A player is tracked when the chat has added them (`/lisaa`) and exactly one round player has
  that name.
- Polls are handled one at a time, in order; an unusable payload is logged and skipped, keeping
  the last good round.
- Polling slows down while scores stay unchanged and backs off after failed requests. The rules
  and their values are in `policy.ts`; the base intervals come from the configuration.
- The round end saves the results, profiles and bagtags before it marks the competition done, so
  a failure leaves the round unfinished and the round end runs again after a restart; the saves
  are safe to repeat. The TOP-5 and bagtag messages after it are best effort: a failed send isn't
  retried.

## Files

| File | Does |
| --- | --- |
| `liveScoring.ts` | `ScoreTracker`: one followed round. Starts it, polls, hands changes to commentary, starts the round end. Its state (`following`, `snapshot`, `trackedPlayers`) answers `/pelit`, `/top5` and `/score`. |
| `poller.ts` | The poll timer: fetches, emits each answered fetch, schedules the next poll. |
| `policy.ts` | The polling rules: the interval by quiet polls, the error backoff, the jitter. |
| `courseData.ts` | The round's course: layout details and statistics (once), and the weather at the layout's coordinates or the parent course's. |
| `roundFinalizer.ts` | `finishRound`: the round end's steps and their order. |
| `topListRanking.ts` | Who is on the TOP-5: each division's top places, then the tracked players outside them. |
| `messages.ts` | What live scoring says in the chat: the fixed texts, the player announcement and the TOP-5. |
| `trackerRegistry.ts` | The rounds each chat follows right now, in memory. |
| `db/` | The `Competition` entity and `competitionRepository`. |
