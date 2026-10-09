import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findBotPin: vi.fn(), saveBotPin: vi.fn(), warn: vi.fn() }));
vi.mock("../../features/chats", () => ({ findBotPin: mocks.findBotPin, saveBotPin: mocks.saveBotPin }));
vi.mock("../../shared/logger", () => ({ moduleLogger: () => ({ warn: mocks.warn }) }));

import { GrammyError } from "grammy";
import { editBotPin, PinApi, removeBotPin, replaceBotPin } from "../botPin";

const CHAT_ID = -100;

function fakeApi() {
  const calls: string[] = [];
  const api = {
    pinChatMessage: vi.fn<PinApi["pinChatMessage"]>(async (_chatId, messageId) => { calls.push(`pin ${messageId}`); return true; }),
    unpinChatMessage: vi.fn<PinApi["unpinChatMessage"]>(async (_chatId, messageId) => { calls.push(`unpin ${messageId}`); return true; }),
    editMessageText: vi.fn<PinApi["editMessageText"]>(async (_chatId, messageId, text) => { calls.push(`edit ${messageId} ${text}`); return true; }),
  };

  return { api, calls };
}

function telegramError(description: string): GrammyError {
  return new GrammyError(description, { ok: false, error_code: 400, description }, "method", {});
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findBotPin.mockResolvedValue(null);
});

describe("replaceBotPin", () => {
  it("unpins the previous pin before pinning the new one, and remembers the new one", async () => {
    mocks.findBotPin.mockResolvedValue(7);
    const { api, calls } = fakeApi();

    await replaceBotPin(api, CHAT_ID, 8);

    expect(calls).toEqual(["unpin 7", "pin 8"]);
    expect(mocks.saveBotPin.mock.calls).toEqual([[CHAT_ID, null], [CHAT_ID, 8]]);
  });

  it("pins with a notification", async () => {
    const { api } = fakeApi();

    await replaceBotPin(api, CHAT_ID, 8);

    expect(api.pinChatMessage).toHaveBeenCalledWith(CHAT_ID, 8);
  });

  it("logs a refused pin, remembers nothing and doesn't throw", async () => {
    const { api } = fakeApi();
    api.pinChatMessage.mockRejectedValue(telegramError("Bad Request: not enough rights to manage pinned messages in the chat"));

    await replaceBotPin(api, CHAT_ID, 8);

    expect(mocks.saveBotPin).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("still pins when the previous pin is gone", async () => {
    mocks.findBotPin.mockResolvedValue(7);
    const { api } = fakeApi();
    api.unpinChatMessage.mockRejectedValue(telegramError("Bad Request: message to unpin not found"));

    await replaceBotPin(api, CHAT_ID, 8);

    expect(api.pinChatMessage).toHaveBeenCalledWith(CHAT_ID, 8);
    expect(mocks.saveBotPin).toHaveBeenLastCalledWith(CHAT_ID, 8);
  });
});

describe("removeBotPin", () => {
  it("unpins and forgets the bot's pin", async () => {
    mocks.findBotPin.mockResolvedValue(7);
    const { api, calls } = fakeApi();

    await removeBotPin(api, CHAT_ID);

    expect(calls).toEqual(["unpin 7"]);
    expect(mocks.saveBotPin).toHaveBeenCalledWith(CHAT_ID, null);
  });

  it("does nothing without a pin", async () => {
    const { api, calls } = fakeApi();

    await removeBotPin(api, CHAT_ID);

    expect(calls).toEqual([]);
    expect(mocks.saveBotPin).not.toHaveBeenCalled();
  });
});

describe("editBotPin", () => {
  it("edits the bot's pin", async () => {
    mocks.findBotPin.mockResolvedValue(7);
    const { api, calls } = fakeApi();

    await editBotPin(api, CHAT_ID, "Tulevat pelit:");

    expect(calls).toEqual(["edit 7 Tulevat pelit:"]);
  });

  it("does nothing without a pin", async () => {
    const { api, calls } = fakeApi();

    await editBotPin(api, CHAT_ID, "Tulevat pelit:");

    expect(calls).toEqual([]);
  });

  it("takes an unchanged text quietly, and logs other refusals", async () => {
    mocks.findBotPin.mockResolvedValue(7);
    const { api } = fakeApi();
    api.editMessageText.mockRejectedValueOnce(telegramError("Bad Request: message is not modified: specified new message content is the same"));
    api.editMessageText.mockRejectedValueOnce(telegramError("Bad Request: message to edit not found"));

    await editBotPin(api, CHAT_ID, "Tulevat pelit:");
    expect(mocks.warn).not.toHaveBeenCalled();

    await editBotPin(api, CHAT_ID, "Tulevat pelit:");
    expect(mocks.warn).toHaveBeenCalledOnce();
  });
});
