import { describe, expect, it } from "vitest";
import { readFixedForm } from "../fixedForm";

/** A Thursday. */
const TODAY = "2026-10-08";

function draftOf(text: string) {
  const result = readFixedForm(text, TODAY);
  if (result.kind !== "plan") throw new Error(`"${text}" read as ${result.kind}`);

  return result.draft;
}

describe("the fixed form's day", () => {
  it.each([
    ["tänään Keljo", "2026-10-08"],
    ["huomenna Keljo", "2026-10-09"],
    ["ylihuomenna Keljo", "2026-10-10"],
    ["la Keljo", "2026-10-10"],
    ["lauantaina Keljo", "2026-10-10"],
    ["Lauantai Keljo", "2026-10-10"],
    ["to Keljo", "2026-10-08"],
    ["ke Keljo", "2026-10-14"],
    ["10.10. Keljo", "2026-10-10"],
    ["10.10.2026 Keljo", "2026-10-10"],
    ["2.1. Keljo", "2027-01-02"],
  ])("reads %s as %s", (text, day) => {
    expect(draftOf(text).day).toBe(day);
  });

  it("reads a time without a day as today", () => {
    expect(draftOf("18 Keljo")).toMatchObject({ day: TODAY, startTime: "18:00" });
  });
});

describe("the fixed form's time", () => {
  it.each([
    ["la 18 Keljo", "18:00"],
    ["la 9.00 Keljo", "09:00"],
    ["la 9:30 Keljo", "09:30"],
    ["la klo 18 Keljo", "18:00"],
    ["la Keljo", null],
  ])("reads %s as %s", (text, startTime) => {
    expect(draftOf(text).startTime).toBe(startTime);
  });

  it("reads a date without its trailing dot as a time", () => {
    expect(draftOf("10.10 Keljo")).toMatchObject({ day: TODAY, startTime: "10:10" });
  });

  it("doesn't read an hour or minute that doesn't exist as a time", () => {
    expect(draftOf("la 24 Keljo")).toMatchObject({ startTime: null, courses: ["24 Keljo"] });
    expect(draftOf("la 9.60 Keljo")).toMatchObject({ startTime: null, courses: ["9.60 Keljo"] });
  });
});

describe("the fixed form's courses", () => {
  it("splits them on + and , in order, each capitalized", () => {
    expect(draftOf("la karjaa + härkälinna, tali").courses).toEqual(["Karjaa", "Härkälinna", "Tali"]);
  });

  it("keeps a course name with spaces whole", () => {
    expect(draftOf("la Keljon kenttä").courses).toEqual(["Keljon kenttä"]);
  });

  it("asks for a course when there's none", () => {
    expect(readFixedForm("la 18", TODAY)).toEqual({ kind: "no-courses" });
  });
});

describe("text that isn't the fixed form", () => {
  it.each([
    "wiltzun ja klasun kanssa karjaa",
    "Keljo la 18",
    "31.2. Keljo",
  ])("leaves %s to be read as free text", text => {
    expect(readFixedForm(text, TODAY)).toEqual({ kind: "free-text" });
  });
});
