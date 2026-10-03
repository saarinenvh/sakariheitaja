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
});
