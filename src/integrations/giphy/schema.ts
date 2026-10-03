import { z } from "zod";

// Giphy → bot, GET api.giphy.com/v1/gifs/search (JSON).

const renditionExample = {
  height: "200", width: "356", size: "1520093", url: "https://media.giphy.com/media/abc123/200.gif",
  mp4_size: "201234", mp4: "https://media.giphy.com/media/abc123/200.mp4", webp_size: "512345", webp: "https://media.giphy.com/media/abc123/200.webp",
};

export const gifSearchExample = {
  data: [
    {
      type: "gif", // ignored
      id: "abc123", // ignored
      url: "https://giphy.com/gifs/example-abc123", // ignored
      slug: "example-abc123", // ignored
      bitly_gif_url: "https://gph.is/g/example", // ignored
      bitly_url: "https://gph.is/g/example", // ignored
      embed_url: "https://giphy.com/embed/abc123", // ignored
      username: "", // ignored
      source: "", // ignored
      title: "Example GIF", // ignored
      rating: "g", // ignored
      content_url: "", // ignored
      source_tld: "", // ignored
      source_post_url: "", // ignored
      is_sticker: 0, // ignored
      import_datetime: "2020-01-01 12:00:00", // ignored
      trending_datetime: "0000-00-00 00:00:00", // ignored
      images: {
        original: {
          height: "270", // ignored
          width: "480", // ignored
          size: "2400123", // ignored
          url: "https://media.giphy.com/media/abc123/giphy.gif",
          mp4_size: "301234", // ignored
          mp4: "https://media.giphy.com/media/abc123/giphy.mp4",
          webp_size: "812345", // ignored
          webp: "https://media.giphy.com/media/abc123/giphy.webp", // ignored
          frames: "40", // ignored
          hash: "0123456789abcdef", // ignored
        },
        fixed_height: renditionExample, // ignored, like the other renditions (downsized, preview, …)
      },
      analytics_response_payload: "e=example", // ignored
      analytics: { onload: { url: "https://giphy-analytics.giphy.com/onload" } }, // ignored
      alt_text: "", // ignored
    },
  ],
  pagination: { total_count: 1234, count: 10, offset: 0 }, // ignored
  meta: { status: 200, msg: "OK", response_id: "example-response" }, // ignored
};

const originalSchema = z.object({ mp4: z.string().optional(), url: z.string().optional() });

export const gifSearchSchema = z.object({
  data: z.array(z.object({
    images: z.object({ original: originalSchema.optional() }).optional(),
  })).nullish(),
});
