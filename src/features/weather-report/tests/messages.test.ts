import { describe, expect, it } from "vitest";
import { formatCityWeather } from "../messages";
import { buildCityWeather } from "../../../tests/fixtures/weather";

describe("formatCityWeather", () => {
  it("shows the condition's emoji, the temperature, wind and sun times", () => {
    const weather = buildCityWeather();

    expect(formatCityWeather(weather)).toBe(
      "\u{2601} Helsinki <b>9.2°C</b> \u{2601}\n"
      + "Tällä hetkellä siis <b>pilvistä</b>.\n"
      + "Tuulta puskis <b>3.1 m/s</b>.\n"
      + "Aurinko nousee <b>7:40</b> 🌅\n"
      + "Aurinko laskee <b>18:20</b> 🌇\n",
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
