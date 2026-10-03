import { z } from "zod";

// Metrix → bot, GET api.php?content=course&id=<course id>&code=<integration code> (JSON).

export const courseExample = {
  course: {
    ID: "12345", // ignored
    ParentID: "1234", // ignored
    Name: "Main Layout", // ignored
    Fullname: "Example Park &rarr; Main Layout", // ignored
    Type: "2", // ignored
    CountryCode: "FI", // ignored
    Area: "Example Region", // ignored
    City: "Example City", // ignored
    Location: null, // ignored
    Lat: "60.1234",
    Lng: "24.5678",
    Enddate: null, // ignored
    RatingValue1: "900",
    RatingResult1: "62.5",
    RatingValue2: "1000",
    RatingResult2: "54.5",
  },
  baskets: [
    {
      Number: "1", NumberAlt: null, Par: "3", Length: "80", Unit: "m",
      TeeLat: "60.1240", TeeLng: "24.5670", BasketLat: "60.1235", BasketLng: "24.5665",
    },
    {
      Number: "2", NumberAlt: "2A", Par: "4", Length: "450", Unit: "ft",
      TeeLat: "60.1232", TeeLng: "24.5660", BasketLat: "60.1228", BasketLng: "24.5680",
    },
  ],
  Errors: [],
};

export const courseErrorsExample = {
  Errors: ["(code) parameter is missing"],
};

const metrixValueSchema = z.union([z.string(), z.number()]).nullish();

const basketSchema = z.object({
  Number: metrixValueSchema,
  NumberAlt: metrixValueSchema,
  Par: metrixValueSchema,
  Length: metrixValueSchema,
  Unit: metrixValueSchema,
  TeeLat: metrixValueSchema,
  TeeLng: metrixValueSchema,
  BasketLat: metrixValueSchema,
  BasketLng: metrixValueSchema,
});

export const courseResponseSchema = z.object({
  course: z.object({
    Lat: metrixValueSchema,
    Lng: metrixValueSchema,
    RatingValue1: metrixValueSchema,
    RatingResult1: metrixValueSchema,
    RatingValue2: metrixValueSchema,
    RatingResult2: metrixValueSchema,
  }),
  baskets: z.array(basketSchema).nullish(),
});

export const courseErrorsSchema = z.object({ Errors: z.array(z.string()).nullish() });

export type MetrixValue = z.output<typeof metrixValueSchema>;
export type MetrixBasket = z.output<typeof basketSchema>;
