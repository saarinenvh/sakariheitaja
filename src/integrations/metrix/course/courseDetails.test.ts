import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCourseDetails, parseCourseDetails } from "./courseDetails";
import { ValidationError } from "../../../util/validation";

const mocks = vi.hoisted(() => ({ getData: vi.fn<(url: string) => Promise<unknown>>() }));
vi.mock("../../../shared/http", () => ({ getData: mocks.getData }));

const INTEGRATION_CODE = "secret-code-123";

const veikkolaResponse = {
  course: {
    ID: "35014", ParentID: "2840", Name: "Veikkola 2024", Fullname: "Veikkolan frisbeegolfrata &rarr; Veikkola 2024", Type: "2",
    CountryCode: "FI", Area: "Uusimaa", City: "Kirkkonummi", Location: null, Lat: "60.2665", Lng: "24.4332", Enddate: null,
    RatingValue1: "909.61", RatingResult1: "63.06", RatingValue2: "1000", RatingResult2: "55.53",
  },
  baskets: [
    {
      Number: "1", NumberAlt: null, Par: "3", Length: "77", Unit: "m",
      TeeLat: "60.268279222396345", TeeLng: "24.433478790971144", BasketLat: "60.267590164608976", BasketLng: "24.43332322284828",
    },
    {
      Number: "16", NumberAlt: null, Par: "5", Length: "198", Unit: "m",
      TeeLat: "60.26528561707982", TeeLng: "24.430176448297946", BasketLat: "60.26654372203071", BasketLng: "24.432716056920743",
    },
  ],
  Errors: [],
};

describe("course details parsing", () => {
  it("reads the location, rating anchors and hole details of a fully filled course", () => {
    const details = parseCourseDetails(veikkolaResponse, "35014");

    expect(details.location).toEqual({ latitude: 60.2665, longitude: 24.4332 });
    expect(details.rating).toEqual({ value1: 909.61, result1: 63.06, value2: 1000, result2: 55.53 });
    expect(details.holes[1]).toEqual({
      label: "16",
      par: 5,
      lengthM: 198,
      tee: { latitude: 60.26528561707982, longitude: 24.430176448297946 },
      basket: { latitude: 60.26654372203071, longitude: 24.432716056920743 },
    });
  });

  it("parses a partially filled course with missing values as null", () => {
    const sparse = {
      course: { Lat: null, Lng: "", RatingValue1: "900", RatingResult1: "60" },
      baskets: [{ Number: "1", NumberAlt: "", Par: "", Length: null, Unit: null, TeeLat: "0", TeeLng: "0", BasketLat: "", BasketLng: null }],
    };

    expect(parseCourseDetails(sparse, "1")).toEqual({
      courseId: "1",
      location: null,
      rating: null,
      holes: [{ label: "1", par: null, lengthM: null, tee: null, basket: null }],
    });
  });

  it("uses the alternative hole number as the label when it is set", () => {
    const response = { course: {}, baskets: [{ Number: "4", NumberAlt: "3A" }] };

    expect(parseCourseDetails(response, "1").holes[0].label).toBe("3A");
  });

  it("converts lengths given in feet to whole metres", () => {
    const response = { course: {}, baskets: [{ Number: "1", Length: "300", Unit: "ft" }] };

    expect(parseCourseDetails(response, "1").holes[0].lengthM).toBe(91);
  });

  it("rejects out-of-range or non-numeric coordinates", () => {
    const response = { course: { Lat: "91", Lng: "24" }, baskets: [{ Number: "1", TeeLat: "abc", TeeLng: "24", BasketLat: "60", BasketLng: "181" }] };

    const details = parseCourseDetails(response, "1");

    expect(details.location).toBeNull();
    expect(details.holes[0]).toMatchObject({ tee: null, basket: null });
  });

  it("drops rating anchors whose two results are equal", () => {
    const response = { course: { RatingValue1: "900", RatingResult1: "60", RatingValue2: "1000", RatingResult2: "60" } };

    expect(parseCourseDetails(response, "1").rating).toBeNull();
  });

  it("treats a missing basket list as a course without holes", () => {
    expect(parseCourseDetails({ course: {} }, "1").holes).toEqual([]);
  });

  it("throws a validation error when there is no course object", () => {
    expect(() => parseCourseDetails({ baskets: [] }, "1")).toThrow(ValidationError);
    expect(() => parseCourseDetails("<html>", "1")).toThrow(ValidationError);
  });
});

describe("course details fetching", () => {
  beforeEach(() => mocks.getData.mockReset());

  it("returns the parsed course", async () => {
    mocks.getData.mockResolvedValue(veikkolaResponse);

    const result = await fetchCourseDetails("35014", INTEGRATION_CODE);

    expect(result.kind).toBe("found");
    expect(mocks.getData.mock.calls[0][0]).toBe(`https://discgolfmetrix.com/api.php?content=course&id=35014&code=${INTEGRATION_CODE}`);
  });

  it("reports Metrix API errors without exposing the integration code", async () => {
    mocks.getData.mockResolvedValue({ Errors: [`Invalid code ${INTEGRATION_CODE}`] });

    const result = await fetchCourseDetails("35014", INTEGRATION_CODE);

    expect(result.kind).toBe("failed");
    expect(JSON.stringify(result)).not.toContain(INTEGRATION_CODE);
    expect(result).toEqual({ kind: "failed", reason: "Metrix course API error: Invalid code [redacted]" });
  });

  it("reports a missing code error from Metrix as a failure", async () => {
    mocks.getData.mockResolvedValue({ Errors: ["(code) parameter is missing"] });

    expect(await fetchCourseDetails("35014", "")).toEqual({ kind: "failed", reason: "Metrix course API error: (code) parameter is missing" });
  });

  it("reports a failed request or an unusable response", async () => {
    mocks.getData.mockResolvedValue(undefined);
    expect(await fetchCourseDetails("35014", INTEGRATION_CODE)).toEqual({ kind: "failed", reason: "Metrix course request failed" });

    mocks.getData.mockResolvedValue({ Errors: [] });
    expect(await fetchCourseDetails("35014", INTEGRATION_CODE)).toEqual({ kind: "failed", reason: "Invalid Metrix course" });
  });
});
