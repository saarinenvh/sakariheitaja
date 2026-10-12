// Ollama → bot: the morning greeting the model writes, a JSON reply constrained to
// `greetingReplyJsonSchema` (Ollama's `format`).
import { z } from "zod";
import { giphySearchWords } from "./phrases";

export const greetingReplyExample = {
  greeting: "Aamuja, sankarit!",
  weather: "Tampereella sataa vaakatasossa, eli tänään kiekko tulee takaisin ennen kuin ehdit heittää.",
  games: "Ei yhtään peliä sovittu. Sohvaperunat on ilmeisesti taas äänestäneet.",
  gifQuery: "rain",
};

export const greetingReplySchema = z.object({
  greeting: z.string().trim().min(1),
  /** Empty when the facts had no weather. */
  weather: z.string().trim(),
  games: z.string().trim().min(1),
  gifQuery: z.enum(giphySearchWords),
});

export type GreetingReply = z.output<typeof greetingReplySchema>;

/** What Ollama constrains the reply to: the greeting's three parts, and one of the gif search words. */
export const greetingReplyJsonSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    greeting: { type: "string", description: "Tervehdys porukalle Saken äänellä, yksi lyhyt lause tai huudahdus." },
    weather: { type: "string", description: "Yksi vitsi säästä; tyhjä, jos säätä ei annettu." },
    games: { type: "string", description: "Kommentti tämän päivän peleistä, tai vittuilu laiskoille, jos pelejä ei ole." },
    gifQuery: { type: "string", enum: [...giphySearchWords], description: "Yksi sana Giphy-hakuun, joka sopii tervehdykseen." },
  },
  required: ["greeting", "weather", "games", "gifQuery"],
};
