# Heckler

Short insults for the chat. Every text message is remembered (the last 10 per chat, in memory);
with the LLM enabled, half of the heckles are written by the model from those with
`prompts/heckler.md` and half picked from `cannedHeckles.ts`; with it disabled, or when the
model fails, they are always canned. Used by the text listener when
Sakari is named, and by `/heckle`.
