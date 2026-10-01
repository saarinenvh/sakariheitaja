import { WeatherObservation } from "../../../../shared/weather";

export const TEMPERATURE_CHANGE_THRESHOLD_C = 3;
export const WIND_CHANGE_THRESHOLD_MS = 3;
const DELTA_PRECISION_FACTOR = 100;
const DISPLAY_DECIMAL_FACTOR = 10;

export function describeWeather(observation: WeatherObservation): string {
  const parts = [`${formatInteger(observation.temperatureC)} °C`, observation.description];
  if (hasPrecipitation(observation)) {
    parts.push(`sademäärä ${formatDecimal(observation.precipitationMmPerHour ?? 0)} mm/h`);
  }
  parts.push(`tuulta ${formatDecimal(observation.windSpeedMs)} m/s`);
  return `Sää: ${parts.join(", ")}.`;
}

export function describeWeatherChange(start: WeatherObservation, current: WeatherObservation): string | null {
  const changes = [
    describeTemperatureChange(start, current),
    describeWindChange(start, current),
    describePrecipitationChange(start, current),
  ].filter(change => change !== null);
  if (changes.length === 0) return null;

  if (current.description !== start.description) changes.push(`sää nyt ${current.description}`);
  return `Kierroksen alusta: ${changes.join(", ")}.`;
}

function describeTemperatureChange(start: WeatherObservation, current: WeatherObservation): string | null {
  const delta = measureDelta(start.temperatureC, current.temperatureC);
  if (Math.abs(delta) < TEMPERATURE_CHANGE_THRESHOLD_C) return null;
  const direction = delta > 0 ? "noussut" : "laskenut";
  return `lämpötila ${direction} ${formatInteger(Math.abs(delta))} °C`;
}

function describeWindChange(start: WeatherObservation, current: WeatherObservation): string | null {
  const delta = measureDelta(start.windSpeedMs, current.windSpeedMs);
  if (Math.abs(delta) < WIND_CHANGE_THRESHOLD_MS) return null;
  const direction = delta > 0 ? "voimistunut" : "heikentynyt";
  return `tuuli ${direction} ${formatDecimal(Math.abs(delta))} m/s`;
}

function describePrecipitationChange(start: WeatherObservation, current: WeatherObservation): string | null {
  const wasPrecipitating = hasPrecipitation(start);
  const isPrecipitating = hasPrecipitation(current);
  if (!wasPrecipitating && isPrecipitating) return "sade alkanut";
  if (wasPrecipitating && !isPrecipitating) return "sade lakannut";
  return null;
}

function hasPrecipitation(observation: WeatherObservation): boolean {
  return (observation.precipitationMmPerHour ?? 0) > 0;
}

// Rounds away float noise so e.g. 8.1 - 5.1 still meets a 3-unit threshold.
function measureDelta(from: number, to: number): number {
  return Math.round((to - from) * DELTA_PRECISION_FACTOR) / DELTA_PRECISION_FACTOR;
}

function formatInteger(value: number): string {
  return String(Math.round(value) || 0);
}

function formatDecimal(value: number): string {
  const rounded = Math.round(value * DISPLAY_DECIMAL_FACTOR) / DISPLAY_DECIMAL_FACTOR;
  return String(rounded || 0).replace(".", ",");
}
