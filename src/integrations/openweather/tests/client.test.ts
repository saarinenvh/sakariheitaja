import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../shared/http", () => ({ getData: mocks.getData }));

import { createOpenWeatherClient } from "../client";

describe("OpenWeatherMap client", () => {
  const client = createOpenWeatherClient({ apiKey: "test-key" });

  beforeEach(() => mocks.getData.mockReset());

  it("GETs the path with the endpoint's query, metric units, Finnish and the key, and returns the body", async () => {
    mocks.getData.mockResolvedValue({ name: "Helsinki" });

    await expect(client.get("/weather", { q: "Helsinki" })).resolves.toEqual({ kind: "ok", body: { name: "Helsinki" } });
    expect(mocks.getData).toHaveBeenCalledWith(
      "https://api.openweathermap.org/data/2.5/weather?q=Helsinki&units=metric&lang=fi&appid=test-key",
    );
  });

  it("encodes the query", async () => {
    mocks.getData.mockResolvedValue({});

    await client.get("/weather", { q: "Hämeen linna&appid=x" });

    expect(mocks.getData.mock.calls[0][0]).toContain("q=H%C3%A4meen+linna%26appid%3Dx&units=metric");
  });

  it("fails when the request fails, and without an API key makes none", async () => {
    mocks.getData.mockResolvedValue(undefined);

    await expect(client.get("/weather", { q: "Helsinki" })).resolves.toEqual({ kind: "failed", reason: "OpenWeatherMap request failed" });
    await expect(createOpenWeatherClient({ apiKey: undefined }).get("/weather", { q: "Helsinki" }))
      .resolves.toEqual({ kind: "failed", reason: "OPENWEATHERMAP_APIKEY is not set" });
    expect(mocks.getData).toHaveBeenCalledTimes(1);
  });
});
