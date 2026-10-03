import { z } from "zod";

// Ollama → bot, the answer to POST /api/chat with stream: false and think: false (ollama/client.ts).

export const chatResponseExample = {
  model: "gemma3:12b", // ignored
  created_at: "2026-10-03T07:42:00.123456789Z", // ignored
  message: {
    role: "assistant", // ignored
    content: "Player One avaa birdiellä!",
  },
  done_reason: "stop", // ignored
  done: true, // ignored
  total_duration: 1843125700, // ignored
  load_duration: 41200500, // ignored
  prompt_eval_count: 1532, // ignored
  prompt_eval_duration: 612004300, // ignored
  eval_count: 38, // ignored
  eval_duration: 1180220900, // ignored
};

// A reply without content counts as empty, which the client reports as an empty response.
export const chatResponseSchema = z.object({
  message: z.object({ content: z.string().nullish() }).nullish(),
});
