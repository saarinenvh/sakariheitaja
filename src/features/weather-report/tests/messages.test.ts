import { describe, expect, it } from "vitest";
import { formatCityWeather } from "../messages";
import { formatClockTime } from "../../../shared/utils";
import { buildCityWeather } from "../../../tests/fixtures/weather";

describe("formatCityWeather", () => {
  it("shows the condition's emoji, the temperature, wind and sun times", () => {
    const weather = buildCityWeather();

    // Sun times are in the process's time zone (Helsinki in prod), so they're formatted the same way here.
    expect(formatCityWeather(weather)).toBe(
      "\u{2601} Helsinki <b>9.2°C</b> \u{2601}\n"
      + "Tällä hetkellä siis <b>pilvistä</b>.\n"
      + "Tuulta puskis <b>3.1 m/s</b>.\n"
      + `Aurinko nousee <b>${formatClockTime(weather.sunrise)}</b> 🌅\n`
      + `Aurinko laskee <b>${formatClockTime(weather.sunset)}</b> 🌇\n`,
    );
  });
});

describe("formatCityWeather's escaping", () => {
  it("escapes the city and the description for Telegram's HTML", () => {
    const html = formatCityWeather(buildCityWeather({ city: "Pori & <Ulvila>", description: "sade & tuuli" }));

    expect(html).toContain("Pori &amp; &lt;Ulvila&gt;");
    expect(html).toContain("<b>sade &amp; tuuli</b>");
  });
});
