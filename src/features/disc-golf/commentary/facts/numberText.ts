const DISPLAY_DECIMAL_FACTOR = 10;

/** One decimal with a Finnish decimal comma: 4.25 → "4,3", 2.0 → "2". */
export function formatDecimal(value: number): string {
  const rounded = Math.round(value * DISPLAY_DECIMAL_FACTOR) / DISPLAY_DECIMAL_FACTOR;
  return String(rounded || 0).replace(".", ",");
}
