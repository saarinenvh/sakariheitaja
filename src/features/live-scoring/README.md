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
    Chat->>Tracker: start()
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
| `new ScoreTracker(...).start()` (`liveScoring.ts`) | `/follow` (`telegram/commands/live-scoring/`) |
| `resumeFollowedRounds` (`roundResumer.ts`) | `main.ts` at startup, for every competition still `following` |
| `registerCompetition` (`liveScoring.ts`) | `/follow`: stores the chat, if new, and the competition |
| `trackerRegistry` (`trackerRegistry.ts`) | `main.ts`, and the `/follow`, `/lopeta`, `/pelit`, `/top5` and `/score` handlers |
| `ScoreTracker.phase`, `ScoreTracker.sendTopList`, `ScoreTracker.getScoreByPlayerName` | `/pelit`, `/top5`, `/score` |
| `competitionRepository` (`db/competitionRepository.ts`) | `/follow` (delete when the round can't start), `/lopeta` (delete), `finishRound` (mark finished), `roundResumer.ts` (rounds still followed; mark error), `/virheet` (rounds in error) |

`registerCompetition` also stores the chat through the `chats` feature, in case the bot missed joining it.

## Data

- Owns the `competitions` table (`db/`): a followed round's chat, Metrix id, day, and `status`:
  `following`, `finished` or `error`. A round in `error` also has `errored_at` and
  `error_reason`; it isn't resumed and stays for manual handling (`/virheet` lists them).
- In memory: the rounds each chat follows or is still starting (`trackerRegistry.ts`), and
  each round's last snapshot and tracked players (`ScoreTracker`). A restart rebuilds them from
  the competitions still `following`.

## Behaviour

- A tracker is `starting`, then `following`, `finishing` once every tracked player is done,
  and `stopped`. Its `phase` shows a `following` round whose Metrix start time is still ahead
  as `scheduled`; `/pelit` lists those under "Tulossa". The table doesn't store `scheduled`:
  the start time comes from Metrix on every start.
- A chat follows a round once. `/follow` takes the round in the registry before it awaits
  anything, so a second `/follow` of it, even at the same moment, is turned down.
- `/follow` and `/lopeta` change the registry and the table before they reply. A failed start
  deletes its competition; a failed delete in `/lopeta` leaves the round running.
- A resumed round is in the registry from the start, so `/lopeta` can stop it. While Metrix
  doesn't answer it retries with the poll error backoff; after six hours, or at once when
  Metrix rejects the round, it is marked `error`. A second `following` row for a round the
  chat already follows is marked `error` as a duplicate instead of being resumed.
- A player is tracked when the chat has added them (`/lisaa`) and exactly one round player has
  that name, ignoring case. `/score <name>` matches the same way.
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
| `liveScoring.ts` | `ScoreTracker`: one followed round. Starts it (the first poll waits until the round's `startsAt`, `policy.ts` `msUntilStart`), polls, hands changes to commentary, starts the round end. Its `phase`, `snapshot` and `trackedPlayers` answer `/pelit`, `/top5` and `/score`. |
| `poller.ts` | The poll timer: fetches, emits each answered fetch, schedules the next poll. |
| `roundResumer.ts` | `resumeFollowedRounds`: a tracker for each round left `following` by the last run, a duplicate marked `error`. `resumeRound`: starts one, retrying while Metrix doesn't answer, and marks it `error` when it gives up. |
| `policy.ts` | The polling rules: the interval by quiet polls, the error backoff, the jitter; and when a resumed round is given up on. |
| `courseData.ts` | The round's course: layout details and statistics (once), and the weather at the layout's coordinates or the parent course's. |
| `roundFinalizer.ts` | `finishRound`: the round end's steps and their order. |
| `topListRanking.ts` | Who is on the TOP-5: each division's top places, then the tracked players outside them. |
| `messages.ts` | What live scoring says in the chat: the fixed texts, the player announcement and the TOP-5. |
| `trackerRegistry.ts` | The rounds each chat follows or is starting, in memory, and the rounds a `/follow` is starting. |
| `db/` | The `Competition` entity and `competitionRepository`. |
