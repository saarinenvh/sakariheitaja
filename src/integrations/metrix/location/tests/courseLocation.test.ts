import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCourseSearchTerm, fetchCourseLocation, selectCourseLocation } from "../courseLocation";
import { MetrixCourse } from "../schema";
import { parseMetrixRound } from "../../round/normalize";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../../shared/http", () => ({ getData: mocks.getData }));

const parent: MetrixCourse = {
  ID: "2787", Name: "Meilahti", Type: "1", Enddate: null, City: "Helsinki", X: "60.19052408181046", Y: "24.8974871635437",
};
const endedParent: MetrixCourse = { ID: "14195", Name: "Meilahti", Type: "1", Enddate: "2019-03-31", City: "Helsinki", X: "60.1899", Y: "24.8976" };
const similarName: MetrixCourse = { ID: "13650", Name: "Meilahti Winter", Type: "2", Enddate: null, City: "Helsinki", X: "61", Y: "25" };

describe("course search term", () => {
  it("uses the parent name before the layout arrow", () => {
    expect(buildCourseSearchTerm("Meilahti &rarr; 16 - Par 48")).toBe("Meilahti");
    expect(buildCourseSearchTerm("Meilahti → 16 - Par 48")).toBe("Meilahti");
  });

  it("uses a standalone course name as is and rejects blank names", () => {
    expect(buildCourseSearchTerm("  Kivikko DiscGolfPark ")).toBe("Kivikko DiscGolfPark");
    expect(buildCourseSearchTerm(" &rarr; 16")).toBeNull();
  });
});

describe("course location selection", () => {
  it("prefers an active parent course with exactly the same name", () => {
    expect(selectCourseLocation([similarName, endedParent, parent], "3433", "Meilahti"))
      .toEqual({ latitude: 60.19052408181046, longitude: 24.8974871635437, city: "Helsinki" });
  });

  it("uses the round's own course entry when it is listed, such as a standalone course", () => {
    const standalone: MetrixCourse = { ...similarName, ID: "3433", Name: "Kivikko", X: "60.2", Y: "25.05" };
    expect(selectCourseLocation([parent, standalone], "3433", "Kivikko")).toEqual({ latitude: 60.2, longitude: 25.05, city: "Helsinki" });
  });

  it("skips unusable coordinates and rejects unknown courses", () => {
    expect(selectCourseLocation([{ ...parent, X: "", Y: "" }, endedParent], "3433", "Meilahti"))
      .toEqual({ latitude: 60.1899, longitude: 24.8976, city: "Helsinki" });
    expect(selectCourseLocation([similarName], "3433", "Meilahti")).toBeNull();
    for (const coordinates of [{ X: "abc", Y: "24" }, { X: "95", Y: "24" }, { X: "60", Y: "Infinity" }, { X: "0", Y: "0" }]) {
      expect(selectCourseLocation([{ ...parent, ...coordinates }], "3433", "Meilahti")).toBeNull();
    }
  });
});

describe("course location fetch", () => {
  beforeEach(() => mocks.getData.mockReset());

  it("searches by the parent name and country and returns the parent course location", async () => {
    mocks.getData.mockResolvedValue({ courses: [endedParent, parent] });
    await expect(fetchCourseLocation("3433", "Meilahti &rarr; 16 - Par 48", "FI"))
      .resolves.toEqual({ kind: "found", location: { latitude: 60.19052408181046, longitude: 24.8974871635437, city: "Helsinki" } });
    expect(mocks.getData.mock.calls[0][0]).toBe(
      "https://discgolfmetrix.com/api.php?content=courses_list&country_code=FI&name=Meilahti",
    );
  });

  it("sends the country code in upper case, which Metrix requires", async () => {
    mocks.getData.mockResolvedValue({ courses: [parent] });
    await fetchCourseLocation("3433", "Meilahti", " fi ");
    expect(mocks.getData.mock.calls[0][0]).toContain("country_code=FI&");
  });

  it("reports a missing course as not found", async () => {
    mocks.getData.mockResolvedValue({ courses: [] });
    await expect(fetchCourseLocation("3433", "Meilahti", "FI")).resolves.toEqual({ kind: "not-found" });
  });

  it("reports request failures and invalid bodies as failed without throwing", async () => {
    mocks.getData.mockResolvedValue(undefined);
    await expect(fetchCourseLocation("3433", "Meilahti", "FI")).resolves.toMatchObject({ kind: "failed" });
    mocks.getData.mockResolvedValue([parent]);
    await expect(fetchCourseLocation("3433", "Meilahti", "FI"))
      .resolves.toEqual({ kind: "failed", reason: "Invalid Metrix course list" });
  });
});

describe("round course id", () => {
  function roundWithCourseId(CourseID: unknown) {
    return parseMetrixRound({ Competition: {
      ID: 123, Name: "Training", Date: "2026-09-28", CourseName: "Test", CourseID, HasSubcompetitions: 0,
      Tracks: [{ Number: 1, Par: 3 }], Results: [],
    } }, "123");
  }

  it("exposes a valid course id and tolerates a missing or invalid one", () => {
    expect(roundWithCourseId("3433").courseId).toBe("3433");
    expect(roundWithCourseId(3433).courseId).toBe("3433");
    expect(roundWithCourseId(undefined).courseId).toBeNull();
    expect(roundWithCourseId("abc").courseId).toBeNull();
    expect(roundWithCourseId(0).courseId).toBeNull();
  });
});
