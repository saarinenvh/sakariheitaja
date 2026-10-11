import { describe, expect, it, vi } from "vitest";

vi.mock("../bot", () => ({ bot: { api: {} } }));

import { createTelegramMessenger } from "../messenger";
import { HTML_NO_PREVIEW } from "../sendOptions";

describe("Telegram messenger", () => {
  it("sends text as is, HTML without link previews, and GIFs as animations", async () => {
    const sendMessage = vi.fn<Parameters<typeof createTelegramMessenger>[0]["sendMessage"]>();
    const sendAnimation = vi.fn<Parameters<typeof createTelegramMessenger>[0]["sendAnimation"]>();
    const messenger = createTelegramMessenger({ sendMessage, sendAnimation });

    await messenger.sendText(-100, "Dodii");
    await messenger.sendHtml(-100, "<b>Tags</b>");
    await messenger.sendAnimation(-100, "https://gif.test/1.gif");

    expect(sendMessage.mock.calls).toEqual([[-100, "Dodii"], [-100, "<b>Tags</b>", HTML_NO_PREVIEW]]);
    expect(sendAnimation).toHaveBeenCalledWith(-100, "https://gif.test/1.gif");
  });
});
