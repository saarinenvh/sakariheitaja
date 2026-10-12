// Ollama → bot: the morning greeting the model writes, a JSON reply constrained to
// `greetingReplyJsonSchema` (Ollama's `format`).
import { z } from "zod";
import { giphySearchWords } from "./phrases";

export const greetingReplyExample = {
  text: "Tampereella sataa vaakatasossa, eli maanantai alkaa juuri niin hyvin kuin ansaitsette.",
  gifQuery: "rain",
};

export const greetingReplySchema = z.object({
  text: z.string().trim().min(1),
  gifQuery: z.enum(giphySearchWords),
});

export type GreetingReply = z.output<typeof greetingReplySchema>;

/** What Ollama constrains the reply to: any text, and one of the gif search words. */
export const greetingReplyJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    text: { type: "string", description: "Aamutervehdys suomeksi, Saken äänellä." },
    gifQuery: { type: "string", enum: [...giphySearchWords], description: "Yksi sana Giphy-hakuun, joka sopii tervehdykseen." },
  },
  required: ["text", "gifQuery"],
};
