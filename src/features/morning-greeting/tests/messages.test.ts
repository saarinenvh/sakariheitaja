import { describe, expect, it } from "vitest";
import { formatFallbackGreeting } from "../messages";

describe("formatFallbackGreeting", () => {
  it("escapes the opening line and the & for Telegram's HTML", () => {
    expect(formatFallbackGreeting("Kalja < jallu & muut \n", "9.00")).toBe(
      "Kalja &lt; jallu &amp; muut \nKello on <b>9.00</b> &amp; tämmöstä keliä ois sit tänää taas luvassa.",
    );
  });
});
