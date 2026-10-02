import { describe, expect, it, vi } from "vitest";

vi.mock("./bot", () => ({ bot: { api: {} } }));

import { createTelegramMessenger } from "./messenger";
import { HTML_NO_PREVIEW } from "./sendOptions";

describe("Telegram messenger", () => {
  it("sends text as is and HTML without link previews", async () => {
    const sendMessage = vi.fn<Parameters<typeof createTelegramMessenger>[0]["sendMessage"]>();
    const sendVideo = vi.fn<Parameters<typeof createTelegramMessenger>[0]["sendVideo"]>();
    const messenger = createTelegramMessenger({ sendMessage, sendVideo });

    await messenger.sendText(-100, "Dodii");
    await messenger.sendHtml(-100, "<b>Tags</b>");
    await messenger.sendVideo(-100, "https://gif.test/1.mp4");

    expect(sendMessage.mock.calls).toEqual([[-100, "Dodii"], [-100, "<b>Tags</b>", HTML_NO_PREVIEW]]);
    expect(sendVideo).toHaveBeenCalledWith(-100, "https://gif.test/1.mp4");
  });
});
