# Commentary findings — 2026-09-28

Ticket: https://trello.com/c/BC6lEHJc
Single implementation PR: https://github.com/saarinenvh/sakariheitaja/pull/35

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

## Code reading path

`Orchestrator.onPollResult` validates the response and calls
`RoundCommentary.observe`. That captures updates and current competition facts.
The publication queue builds the factual brief using last acknowledged standings,
adds that player's history, and calls the runtime writer. The writer serializes
explicit descriptions, the model generates prose, and the formatter creates the
Telegram message. Successful delivery advances standings and appends history.

The internal unions distinguish new scores, edits and removals; they prevent
mixing up required data in code. The model no longer receives those unions as
its event-description contract.

## Verification and remaining limits

Automated tests cover isolation, full-history retention, delivery failures,
same-poll facts, score-gap direction and ties, noncomparable scores, training
payload shape, explicit score wording and the requested context size. Mocked
tests cannot establish fluent Finnish or compliance with the length target.

Local verification for this chunk: all 183 tests passed, along with lint,
TypeScript checking, the application build, Docker build and diff whitespace
checks. A writer-contract regression reproducer fails on archived pre-phase-4
commit `b32063e`: the old serialized input has no explicit event description.
The new writer assertions pass with explicit birdie, zero-OB and separate total
descriptions. The prior poll regression also demonstrates the old unchanged-sum
detector missing offsetting score corrections. Live quality is not yet verified.

Owner verification:

1. Restart the development bot with `BOT_OLLAMA_TRACE=true`; follow a training
   round. Initial scores establish a baseline without replaying old commentary.
2. Enter scores for three players over at least two updates. Each player's second
   request must contain only their own first published comment, plus current
   competition facts. The first batch has empty histories.
3. Check par, birdie, bogi and a large over-par score with zero OB; then an explicit
   OB. Confirm hole and round totals are not confused and zero OB is not invented.
4. Try ties, changes in position and different recorded-hole counts. Unknown
   movement must not become a rise/fall; unavailable comparisons must not become
   a claimed margin or sole lead.
5. Correct and remove scores. These should be described as edits, not fresh play.
6. Evaluate short natural Finnish with varied openings, usually 1–3 sentences in
   one paragraph. Exceptional results can be longer. Keep opinions and roasting.
7. Continue a full round. Inspect provider input counts, completion reasons,
   latency and memory at the 16k request setting. This does not prove the server
   honored the entire window; investigate provider behavior if retention degrades.
8. Disable tracing and delete private logs when finished.

Output validation checks usability and player naming, not semantic truth. History
can retain earlier model mistakes; current facts must override it. State remains
in memory, with no durable outbox or retry guarantee. Large competition fields
and long histories still consume context. Course entities may still appear in
the deterministic heading; removing course metadata from the writer does not
claim to fix general HTML entity decoding.
