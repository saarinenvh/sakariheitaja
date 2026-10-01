# Commentary findings — 2026-09-28 to 2026-10-01

Ticket: https://trello.com/c/BC6lEHJc
Single implementation PR: https://github.com/saarinenvh/sakariheitaja/pull/35

The sections up to "Follow-up: first names and prompt experiments" record the
per-player design and are kept as evidence. The batch format replaced it; see
"Batch format, eval harness and course facts" for what shipped.

## Evidence from owner testing

The owner ran the standalone development bot, followed a real Metrix training
round, entered scores and waited for Telegram updates. Agents did not run live
services. The first six-hole sample included invented OBs, confused hole and
round scores, repeated openings, unnatural Finnish and excessively long text.

The supplied training response has `HasSubcompetitions: 0` and omits
`SubCompetitions`. The initial adapter required that array, rejecting a valid
training response. The owner temporarily removed its validation. The corrected
adapter accepts absence, null or an empty array while rejecting explicit children
or a nonzero parent flag. Presence of the field alone is not a parent indicator.
Type values are not used to guess event structure.

Local diagnostic traces of the next test show:

- The actual model was `gemma3:12b`.
- Three hole-8 requests used 3439–3442 input tokens with an 8192-token requested
  window. Outputs were 71–157 tokens and ended with `done_reason: stop`.
  This sample provides no evidence of context exhaustion or output-budget cutoff.
- Every request had zero OB and empty narrative history. No OB was invented in
  this particular sample; the earlier OB errors remain an owner-reported finding.
- A two-throw birdie on hole 8 and a round total of -3 became an ambiguous
  eight-hole -1 statement. A known first place with unknown movement became a
  claim suggesting a move into the lead.
- All three outputs independently used the same opening supplied in the prompt.
  Prompt anchoring is a plausible explanation, not a controlled experimental result.
- Hole-9 traces contained all three previously published comments. History was
  working, but shared division history was broader than the desired player story.

Raw logs contain private conversation text and are not committed or included in
Docker builds. The trace logger preserves requests and provider responses before
cleanup; it is not a factual correctness evaluator.

## Agreed changes in this review chunk

1. Preserve full published history per tracked player, not per division. Append
   only acknowledged Telegram text; do not compact or reset every six holes.
2. Capture current competition facts from the same poll as the update, including
   untracked same-division players. Calculate directional score gaps in code only
   for comparable recorded hole sets and nonprovisional, non-DNF players. Missing
   comparisons stay unknown, not zero. These are recorded-score gaps, not forecasts.
3. Translate internal discriminated unions into writer-facing descriptions.
   `events` explains new, corrected or removed hole scores; `recordedRoundTotal`
   explicitly describes the total; standings and unknown movement stay separate.
   Course names are presentation metadata, not writer input.
4. Request 16384 context tokens while preserving diagnostic usage reporting.
   This is a trial capacity, not a guarantee that unlimited history fits.
5. Retain the shared persona. Shorten commentator instructions, remove stock
   sentence examples and omit the full technique vocabulary from this task.
6. Target one paragraph, usually 1–3 short sentences per player. Exceptional
   events may justify 4–5. This supersedes the earlier no-sentence-guidance policy;
   no hard sentence truncation is added. Names remain mandatory, placement varies,
   and Telegram headings/score footers retain their existing shape.

## Follow-up: humour direction before the next owner test

The owner clarified that the vocabulary examples express the desired humour,
not literal telemetry or complete comments. The target is the energy of the
pre-LLM reactions: vivid praise, result-appropriate roasting and competition
context, not a cautious score report with swearing attached.

This supersedes step 5 above: vocabulary is restored and rewritten as a compact
result-oriented humour toolkit. Runtime order is persona → vocabulary →
commentator rules. The shared persona is unchanged. The commentary role explicitly
permits invented throw imagery as comic colour, including exploding baskets or
an imagined disc swimming lesson. Scores, OB entries, names, standings and gaps
remain factual. A lake joke must not turn zero OB into an OB claim. A current
gap does not prove it widened or narrowed. Starframe needs explicit group-result
facts, which the current competition snapshot does not supply.

The writer's play-order note is aligned with this permission instead of implying
all imagined action is forbidden. No scoring, history or sampling changes are
made in this follow-up. One paragraph and the 1–3 sentence target remain.
Recent-form/streak facts are not added by this prompt change; old jokes must not
be used as proof of a streak or actual throw technique.

A runtime regression test first failed because vocabulary was omitted, then
passes with the real prompt files loaded in the intended order. This verifies
wiring, not humour quality. For the next owner test compare ace/birdie/par/bogi/
tupla reactions, zero versus positive OB, and leading versus chasing. Expect
result-appropriate vocabulary and fresh comic imagery without identical stock
openings, fabricated OBs or unsupported gap-change claims.

Follow-up local verification: 185 tests, lint, TypeScript checking, application
build and Docker build pass. No live model call was made by the agent.

## Follow-up: first names and prompt experiments

The writer now gives the model capitalized first names for the commented player
and every competitor, keeping full names when first names collide within the
division. Gap descriptions refer to "the commented player" instead of embedding
a full name. The Telegram footer keeps full Metrix names, and the player-name
check accepts the first name.

Owner prompt experiments on 2026-09-28 were reverted; the committed prompts are
unchanged by this follow-up. Findings from those experiments:

- Long, instruction-heavy prompts pulled output towards written, report-style
  Finnish. A roughly 120-word commentator prompt without persona or vocabulary
  produced the most natural spoken Finnish so far, but lost the fact rules
  (an unknown movement became "johtoon") and disc-golf imagery.
- Example lines were copied as templates, including placeholder brackets and
  situation labels, and phrases were reused for the wrong results.
- Showing each player's comment the other comments already written for the same
  hole was tried earlier and made every comment end with a recap of the other
  players. It is not pursued.
- Code-injected text in the model input also sets tone: `playOrder` is a style
  permission disguised as data, and the other fields are formal written Finnish.
- Per-player calls cannot vary structure relative to each other, and the model
  has no fact about how the lead developed, only current standings.

A batch format (one call per update: situation opening, very short line per
player, closing situation) is being explored on a separate spike branch.

## Batch format, eval harness and course facts

Per-player calls couldn't vary structure relative to each other, and the model had
no view of the round as a whole. Shared hole context had already been tried and
caused recaps. The batch format (one call per division update) was spiked on
`spike/BC6lEHJc-batch-commentary` and adopted by the owner on 2026-10-01.

Agreed decisions:

- One message per division update: an opening that doesn't know this hole's results
  yet, a line of one or two sentences per player, and a closing reacting to the
  hole. Code inserts the result rows. The model returns JSON under a response schema;
  player names are an enum, which stopped misspelled names causing fallbacks.
- The model gets compact facts rather than code-written prose: hole results,
  round totals, places and movement, standings sorted by place with gaps to the
  leader, the full scorecard table, lead history, whether hole order is play
  order, the current hole, weather at the start and a halfway recheck, the three
  latest delivered messages, and a code-derived `firstMessage` flag.
- Course and hole facts are optional enrichment: par, length and wind relative to
  the throwing direction from the Metrix course API (personal integration code),
  historical difficulty and aces from the public course page, today's field
  average, the course's par-rating class and round ratings at the finish. Any of
  them may be missing on community-edited layouts; failures and hangs drop only
  those facts.
- Metrix ties and early-round places (0 or missing) become shared places derived
  from recorded totals.
- The owner tunes the prompt (`batch_commentator.md`) with the eval harness.

Eval harness (`npm run eval:commentary`, see README): replays anonymized real rounds
hole by hole through the real `RoundCommentary` and writer against a live Ollama,
runs deterministic checks and writes a report per run. It runs on the dev PC's
5080 with the production model `gemma4:26b-a4b-q3`. Findings it produced:

- Fallbacks came from misspelled names in the JSON reply, not prompt issues; the
  name enum fixed them.
- Place errors ("nousi kolmannelle sijalle" for a player in 7th) came from the
  standings list keeping Metrix's final-result order; sorting by place removed them.
- Putting the line before the name in the schema didn't stop lines opening with
  the name (33 of 36); reverted.
- Player lines vary in structure mostly when something notable happened, which
  points to per-player story facts as the next improvement.

Open for later: per-player story facts (streaks, first bogey, worst hole), the
player-line structure, and the q3 quantization's occasional broken words.

## Code reading path

See "Commentary flow" in the README; it follows the code from
`Orchestrator.onPollResult` through facts, writer and presentation.

## Verification and remaining limits

Automated tests cover the reply schema and its fallbacks, standings order and gaps,
shared places for ties, lead history, the scorecard table, weather and course facts
with every missing-data path, course-data failure, hang and composition errors, the
first-message flag, delivery acknowledgment and isolation. They can't establish
fluent Finnish; that is what the eval harness and owner testing are for.

Owner verification on the dev bot:

1. Follow a real or training round with `BOT_OLLAMA_TRACE=true`, with and without
   `BOT_METRIX_INTEGRATION_CODE`. The log shows whether course data was found.
2. The first message welcomes the audience; later openings lead into the next hole
   without knowing its results; closings react to the standings.
3. Results, OB mentions, places and leads match the result rows. Ties show a shared
   place, not "sija ?".
4. With the integration code, hole facts such as length, wind and difficulty appear
   in openings or lines without being listed mechanically.
5. Correct and remove a score; it's described as an edit.
6. Finish a round on a layout with rating data: the result row and the TOP-5 show
   `rating N`. The commentary mentions a rating only when it's 1000 or more,
   980–999 or below 750.
7. Disable tracing and delete private logs when finished.

State remains in memory, with no durable outbox or retry guarantee. Output
validation checks structure and player names, not semantic truth.
