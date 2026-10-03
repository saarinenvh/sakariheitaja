# Match-play asker

Answers questions when Sakari is named, with the club context. A question about the club's
match-play bracket also gets the bracket facts: one line for "who plays next" when the player
resolves to one person, otherwise the whole bracket. Returns nothing when the model fails, and the
text listener falls back to a heckle.

## Entry points

| Entry point | Called by |
| --- | --- |
| `llmAnswer` | the text listener (`telegram/commands/chatter/`), with the LLM enabled |

## Data

None stored. The bracket comes from Challonge (`ChallongeClient`) on each match-play question; the
prompt files are read once.

## Files

| File | Does |
| --- | --- |
| `matchPlayAsker.ts` | Builds the question, adds the bracket facts for match-play questions, calls the model. |
| `policy.ts` | Whether a question is about match play, and whether it asks who someone plays next. |
| `bracket.ts` | Finds the player a question is about and their next match; the whole bracket as text. |
| `prompts.ts` | The system prompt (`src/prompts/persona.md`, `asker.md`, the context notes), the date line, the question and the bracket-facts blocks. |
