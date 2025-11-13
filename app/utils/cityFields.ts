export type CityFieldPayload = { cityExternalId?: string; city?: string | null };

/**
 * Build city payload fields according to backend contract.
 * If externalId present: send only cityExternalId.
 * Otherwise fallback to a provided city name or query string (if any).
 */
export function buildCityFields(cityExternalId: string | null | undefined, cityName?: string | null, fallbackQuery?: string): CityFieldPayload {
  if (cityExternalId) {
    return { cityExternalId, city: undefined };
  }
  const name = (cityName || fallbackQuery || '').trim();
  return name ? { city: name } : {};
}
