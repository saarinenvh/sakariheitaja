import { describe, expect, it, vi } from "vitest";

vi.mock("./bot", () => ({ bot: { api: {} } }));

import { createTelegramMessenger } from "./messenger";
import { HTML_NO_PREVIEW } from "../config/bot";

describe("Telegram messenger", () => {
  it("sends text as is and HTML without link previews", async () => {
    const sendMessage = vi.fn<Parameters<typeof createTelegramMessenger>[0]["sendMessage"]>();
    const messenger = createTelegramMessenger({ sendMessage });

    await messenger.sendText(-100, "Dodii");
    await messenger.sendHtml(-100, "<b>Tags</b>");

    expect(sendMessage.mock.calls).toEqual([[-100, "Dodii"], [-100, "<b>Tags</b>", HTML_NO_PREVIEW]]);
  });
});
