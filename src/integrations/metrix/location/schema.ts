import { z } from "zod";

// Metrix → bot, GET api.php?content=courses_list&country_code=<code>&name=<parent course name> (JSON).

export const coursesListExample = {
  courses: [
    {
      ID: "1234",
      ParentID: null, // ignored
      Name: "Example Park",
      Fullname: "Example Park", // ignored
      Type: "1",
      CountryCode: "FI", // ignored
      Area: "Example Region", // ignored
      City: "Example City",
      Location: "Example Sports Park", // ignored
      X: "60.1234",
      Y: "24.5678",
      Enddate: null,
    },
    {
      ID: "2345", ParentID: null, Name: "Example Park", Fullname: "Example Park", Type: "1", CountryCode: "FI",
      Area: "", City: "", Location: null, X: "60.1229", Y: "24.5671", Enddate: "2019-03-31",
    },
  ],
  Errors: [], // ignored
};

const courseSchema = z.object({
  ID: z.string(),
  Name: z.string().nullish(),
  Type: z.string().nullish(),
  Enddate: z.string().nullish(),
  City: z.string().nullish(),
  X: z.string().nullish(),
  Y: z.string().nullish(),
});

export const coursesListSchema = z.object({ courses: z.array(courseSchema) });

export type MetrixCourse = z.output<typeof courseSchema>;
