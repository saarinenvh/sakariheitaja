import { z } from "zod";

// OpenWeatherMap → bot, GET api.openweathermap.org/data/2.5/weather (units=metric, lang=fi).
// One endpoint, read twice: by coordinates for commentary, and by city name for /saa.

/** The reply to `?lat=&lon=`, for commentary. */
export const currentWeatherExample = {
  coord: { lon: 24.5678, lat: 60.1234 }, // ignored
  weather: [{ id: 500, main: "Rain", description: "heikko vesisade", icon: "10d" }], // ignored: id, main, icon
  base: "stations", // ignored
  main: {
    temp: 8.4,
    feels_like: 5.9, // ignored
    temp_min: 7.8, // ignored
    temp_max: 9.1, // ignored
    pressure: 1004, // ignored
    humidity: 87, // ignored
    sea_level: 1004, // ignored
    grnd_level: 1001, // ignored
  },
  visibility: 10000, // ignored
  wind: { speed: 4.6, deg: 220, gust: 8.2 }, // ignored: gust
  rain: { "1h": 0.4 },
  // snow: { "1h": … } when it snows.
  clouds: { all: 90 }, // ignored
  dt: 1790000000,
  sys: { type: 2, id: 2000001, country: "FI", sunrise: 1789968000, sunset: 1790008000 }, // ignored
  timezone: 10800, // ignored
  id: 600001, // ignored
  name: "Example City", // ignored
  cod: 200, // ignored
};

/** The reply to `?q=<city>`, for /saa. */
export const cityWeatherExample = {
  coord: { lon: 24.9384, lat: 60.1699 }, // ignored
  weather: [{ id: 803, main: "Clouds", description: "pilvistä", icon: "04d" }], // ignored: id, icon
  base: "stations", // ignored
  main: {
    temp: 9.2,
    feels_like: 7.1, // ignored
    temp_min: 8.6, // ignored
    temp_max: 9.9, // ignored
    pressure: 1012, // ignored
    humidity: 79, // ignored
    sea_level: 1012, // ignored
    grnd_level: 1009, // ignored
  },
  visibility: 10000, // ignored
  wind: { speed: 3.1, deg: 250, gust: 6.4 }, // ignored: deg, gust
  clouds: { all: 75 }, // ignored
  dt: 1790000000, // ignored
  sys: { type: 2, id: 2000002, country: "FI", sunrise: 1789968000, sunset: 1790008000 }, // ignored: type, id, country
  timezone: 10800, // ignored
  id: 658225, // ignored
  name: "Helsinki",
  cod: 200, // ignored
};

const precipitationSchema = z.object({ "1h": z.number().nonnegative().optional() }).optional();

export const currentWeatherSchema = z.object({
  dt: z.number().int().positive(),
  main: z.object({ temp: z.number() }),
  wind: z.object({ speed: z.number().nonnegative(), deg: z.number().min(0).max(360).optional() }),
  weather: z.array(z.object({ description: z.string() })).min(1),
  rain: precipitationSchema,
  snow: precipitationSchema,
});

export type CurrentWeatherResponse = z.output<typeof currentWeatherSchema>;

export const cityWeatherSchema = z.object({
  name: z.string(),
  main: z.object({ temp: z.number() }),
  weather: z.array(z.object({ main: z.string(), description: z.string() })).min(1),
  wind: z.object({ speed: z.number() }),
  sys: z.object({ sunrise: z.number(), sunset: z.number() }),
});

/** The weather at a city, as `/saa` shows it. */
export type CityWeather = z.output<typeof cityWeatherSchema>;
