# Live scoring flow

One followed round, from `/follow` to the round end. The feature details are in
[`src/features/live-scoring/README.md`](../../src/features/live-scoring/README.md) and
[`src/features/commentary/README.md`](../../src/features/commentary/README.md); this page
shows how the pieces call each other.

## Following a round

```mermaid
sequenceDiagram
    actor User
    participant Cmd as /follow handler
    participant Comp as chats, competitions
    participant Tracker as ScoreTracker
    participant Metrix as MetrixClient
    participant Players as playerRepository
    participant Commentary as RoundCommentary
    participant Ollama as OllamaClient
    participant Messenger as ChatMessenger

    User->>Cmd: /follow 3809486
    Cmd->>Cmd: trackerRegistry.reserve — once per chat and round
    Cmd->>Comp: addIfAbsent(chat), create(chatId, metrixId)
    Cmd->>Tracker: new ScoreTracker(...).start()
    Tracker->>Metrix: getRound(metrixId)
    Metrix-->>Tracker: MetrixRound (normalized)
    Tracker->>Players: findByChatId
    Tracker->>Commentary: observe(round, tracked) — the baseline
    Tracker->>Messenger: player announcement
    Cmd->>Cmd: trackerRegistry.add

    loop Poller: slower while scores stay unchanged (live-scoring/policy.ts)
        Tracker->>Metrix: getRound
        Tracker->>Players: findByChatId
        Tracker->>Commentary: observe(round, tracked)
        Note over Commentary: detect → facts
        Commentary->>Commentary: special scores: add the new holes, or rebuild from the card after a correction or on a first look
        Commentary->>Ollama: generateStructured(facts)
        Ollama-->>Commentary: opening, lines, closing (or fallback)
        Commentary->>Messenger: sendHtml (one message per division)
        Messenger-->>Commentary: sent
        Note over Commentary: acknowledge: places, recent messages
    end
```

- Polls are handled one at a time, in order. A failed request or an unusable payload is logged
  and skipped; the last good round stays.
- Course details, statistics and weather (`RoundCourseData`) are fetched with timeouts and never
  hold back a message.
- Only an acknowledged send moves the published places and the recent-message history forward.
  A failed send is logged, not retried.

## Round end

```mermaid
sequenceDiagram
    participant Tracker as ScoreTracker
    participant Commentary as RoundCommentary
    participant End as finishRound
    participant Db as score-records, competitions
    participant Json as bagtags, player-profiles
    participant Messenger as ChatMessenger

    Note over Tracker: every tracked player finished or DNF
    Tracker->>Tracker: stop polling
    Tracker->>Commentary: idle() — the last message goes out first
    Tracker->>End: finishRound(round, tracked)
    End->>Messenger: end message
    End->>Db: course, final results
    End->>Json: profiles, bagtag swaps
    End->>Db: competition marked finished
    End->>Messenger: TOP-5 (with ratings)
    End->>Messenger: bagtag announcement
```

The competition is marked `finished` only after everything is saved. If a step before it fails,
the round stays `following` and the round end runs again after a restart; those steps are safe to
repeat. The TOP-5 and bagtag messages after it are best effort.

## `/lopeta`, restarts

- `/lopeta <metrixId>` deletes the competition, then stops the tracker, then replies. If the
  delete fails, the round goes on.
- A restart loses the in-memory state. `main.ts` resumes each competition still `following`
  with a fresh tracker that takes the current scorecards as its baseline: nothing is replayed,
  and no movement is claimed against the old ranking.
- A resumed round that can't start retries in the background (`roundResumer.ts`) while Metrix
  doesn't answer. After six hours, or at once when Metrix rejects the round, the competition
  is marked `error` and stays for manual handling; `/virheet` lists those.
