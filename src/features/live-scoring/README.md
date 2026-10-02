# Live scoring

Follows a Disc Golf Metrix round in a chat. `/follow <id>` starts it; on startup, `main.ts`
resumes every competition not marked done. The commentary on each update comes from
`../disc-golf/commentary/`; this feature owns the round's lifecycle around it.

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
    loop every poll (Poller: 30 s active → 60 s idle → 120 s dormant, backoff on errors)
        Tracker->>Metrix: getRound
        Tracker->>Commentary: observe(round, tracked players)
        Commentary-->>Chat: one message per division update
    end
    Note over Tracker: every tracked player finished or DNF
    Tracker->>Commentary: idle() — last message out first
    Tracker->>End: finishRound
    End->>Chat: end message, TOP-5, bagtags
```

| File | Does |
| --- | --- |
| `scoreTracker.ts` | One followed round: start, poll, hand changes to commentary, start the round end. Its state (`following`, `snapshot`, `trackedPlayers`) answers `/pelit`, `/top5` and `/score`. |
| `poller.ts` | Timing: 30 s while scores change, 60 s after 3 quiet polls, 120 s after 10; exponential backoff after failed requests. |
| `courseData.ts` | The round's course: layout details and statistics (once), and the weather at the layout's coordinates or the parent course's. |
| `roundFinalizer.ts` | The round end: end message; results, profiles and bagtags saved; competition marked done; then the TOP-5 and the bagtag announcement. Done comes after the saves, so a failure leaves the round unfinished and the round end runs again after a restart; the saves are safe to repeat. The TOP-5 and bagtag messages after it are best effort: a failed send isn't retried. |
| `playerAnnouncement.ts`, `topList.ts` | The start message and the TOP-5 (with ratings for finished rounds). |
| `trackerRegistry.ts` | The rounds each chat follows right now, in memory. |

A player is tracked when the chat has added them (`/lisaa`) and exactly one round player has that name.
Polls are handled one at a time, in order; an unusable payload is logged and skipped, keeping the last
good round.
