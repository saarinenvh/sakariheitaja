import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so this checks what /lisaa and /poista report, without a database.
vi.mock("../db/playerRepository", () => ({
  addIfAbsent: vi.fn(async () => undefined),
  findByName: vi.fn(async () => ({ id: 3, name: "Ville" })),
  findByChatId: vi.fn(async () => []),
  linkToChat: vi.fn(async () => true),
  unlinkFromChat: vi.fn(async () => true),
}));

import * as playerRepo from "../db/playerRepository";
import { addToGroup, removeFromGroup } from "../players";

beforeEach(() => vi.clearAllMocks());

describe("addToGroup", () => {
  it("adds the player when new, then links them to the chat", async () => {
    await expect(addToGroup("Ville", -100)).resolves.toEqual({ added: true });

    expect(playerRepo.addIfAbsent).toHaveBeenCalledWith("Ville");
    expect(playerRepo.linkToChat).toHaveBeenCalledWith(3, -100);
  });

  it("reports a player the chat already follows as not added", async () => {
    vi.mocked(playerRepo.linkToChat).mockResolvedValueOnce(false);

    await expect(addToGroup("Ville", -100)).resolves.toEqual({ added: false });
  });
});

describe("removeFromGroup", () => {
  it("unlinks a known player", async () => {
    await expect(removeFromGroup("Ville", -100)).resolves.toEqual({ found: true, removed: true });

    expect(playerRepo.unlinkFromChat).toHaveBeenCalledWith(3, -100);
  });

  it("reports an unknown player without unlinking anything", async () => {
    vi.mocked(playerRepo.findByName).mockResolvedValueOnce(null);

    await expect(removeFromGroup("Jori", -100)).resolves.toEqual({ found: false, removed: false });
    expect(playerRepo.unlinkFromChat).not.toHaveBeenCalled();
  });
});
