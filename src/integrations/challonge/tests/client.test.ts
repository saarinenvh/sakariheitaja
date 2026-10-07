import { afterEach, describe, expect, it, vi } from "vitest";
import { createChallongeClient } from "../client";

const client = createChallongeClient({ tournamentUrl: "https://challonge.com/fi/yvept9b5", apiKey: "key" });

function reply(body: unknown): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
}

afterEach(() => vi.unstubAllGlobals());

describe("Challonge client", () => {
  it("reads the bracket's participants and matches", async () => {
    reply({ tournament: {
      name: "Match play 2026",
      participants: [{ participant: { id: 1, name: "Ville" } }, { participant: { id: 2, name: null, display_name: "Teppo" } }],
      matches: [{ match: { round: 1, player1_id: 1, player2_id: 2, winner_id: null, state: "open", scores_csv: "" } }],
    } });
    expect(await client.fetchBracket()).toEqual({
      tournamentName: "Match play 2026",
      participants: [{ id: 1, name: "Ville" }, { id: 2, name: "Teppo" }],
      matches: [{ round: 1, player1Id: 1, player2Id: 2, winnerId: null, state: "open", scoresCsv: "" }],
    });
  });

  it("rejects a reply without the bracket instead of returning an empty one", async () => {
    reply({ errors: ["Tournament not found"] });
    await expect(client.fetchBracket()).rejects.toThrow("Invalid Challonge bracket");
    reply({ tournament: { name: "Match play", participants: [] } });
    await expect(client.fetchBracket()).rejects.toThrow("Invalid Challonge bracket");
  });

  it("throws with the status on an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));

    await expect(client.fetchBracket()).rejects.toThrow("Challonge API 401");
  });

  it("asks with a timeout, and throws when there's no answer in time", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.fetchBracket()).rejects.toThrow("Challonge API request failed: The operation was aborted due to timeout");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Accept: "application/json" }, signal: expect.any(AbortSignal) });
  });
});
