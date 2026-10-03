import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../shared/http", () => ({ getData: mocks.getData }));

import { createMetrixClient } from "../client";
import { UnsupportedRoundError } from "../round/normalize";

const round = {
  Competition: {
    ID: "123", Name: "Viikkokisa", Date: "2026-10-02", CourseName: "Testirata",
    Tracks: [{ Number: "1", Par: "3" }], Results: [{ Name: "Matti", ClassName: "MA3", PlayerResults: [[]] }],
  },
};

beforeEach(() => mocks.getData.mockReset());

describe("Metrix client", () => {
  const client = createMetrixClient({ integrationCode: undefined, commentaryCountryCode: "FI" });

  it("returns the normalized round from the result API", async () => {
    mocks.getData.mockResolvedValue(round);
    const result = await client.getRound("123");
    expect(mocks.getData).toHaveBeenCalledWith("https://discgolfmetrix.com/api.php?content=result&id=123");
    expect(result).toMatchObject({ kind: "fetched", round: { id: "123", holeLabels: ["1"], players: [{ name: "Matti" }] } });
  });

  it("tells a failed request from a payload that doesn't parse", async () => {
    mocks.getData.mockResolvedValue(undefined);
    expect(await client.getRound("123")).toEqual({ kind: "unavailable" });
    mocks.getData.mockResolvedValue({ Competition: { ...round.Competition, Tracks: [] } });
    expect(await client.getRound("123")).toEqual({ kind: "invalid", error: expect.any(UnsupportedRoundError) });
  });

  it("doesn't call the course API without the integration code", async () => {
    expect(await client.getCourseDetails("456")).toEqual({ kind: "unconfigured" });
    expect(mocks.getData).not.toHaveBeenCalled();
  });
});
