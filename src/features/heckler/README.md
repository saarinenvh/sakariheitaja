# Heckler

Short insults for the chat. With the LLM enabled, some heckles are written by the model from the
chat's recent messages and the rest are canned; with it disabled, or when the model fails, they
are always canned.

## Entry points

| Entry point | Called by |
| --- | --- |
| `recordMessage` | the text listener (`telegram/commands/chatter/`), for every text message |
| `heckle` | the text listener, when Sakari is named and the asker gave no answer (LLM off or the model failed) |
| `getRecentMessages` | the text listener, for the match-play asker's context |
| `llmHeckle` | `/heckle` (`telegram/commands/dev/`) |

## Data

In memory only: each chat's latest messages, a bounded number per chat.

## Files

| File | Does |
| --- | --- |
| `heckler.ts` | Remembers messages, picks canned or model, calls the model. |
| `prompts.ts` | The system prompt (`src/prompts/persona.md` and `heckler.md`) and the user message. |
| `phrases.ts` | The canned heckles. |
