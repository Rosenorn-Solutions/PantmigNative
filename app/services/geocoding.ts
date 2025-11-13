// Lightweight geocoding abstraction for both native and web screens.
// Providers: 'photon' (default), 'nominatim', 'mapbox', 'opencage'.
// Configure via EXPO_PUBLIC_GEOCODER_PROVIDER and provider-specific keys:
// - EXPO_PUBLIC_MAPBOX_TOKEN
// - EXPO_PUBLIC_OPENCAGE_KEY
// NOTE: For OSM/Nominatim usage, we set a descriptive User-Agent per their policy.

export type GeocodeResult = {
  display: string;
  lat: number;
  lon: number;
};

type Provider = 'nominatim' | 'mapbox' | 'opencage' | 'photon';

// Default to Photon to avoid Nominatim rate limits; override via EXPO_PUBLIC_GEOCODER_PROVIDER if needed.
const provider: Provider = (process.env.EXPO_PUBLIC_GEOCODER_PROVIDER as Provider) || 'photon';

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const PHOTON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bDanmark\b/gi, 'Denmark'],
  [/\bKobenhavn\b/gi, 'Copenhagen'],
];

function asciiFold(value: string): string {
  return value.normalize('NFD').replaceAll(DIACRITICS_REGEX, '');
}

function sanitizePhotonQuery(query: string): string {
  let result = asciiFold(query);
  for (const [pattern, replacement] of PHOTON_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// UI helpers (configurable via env). Used by search bars to reduce API load and improve UX.
export const GEOCODER_MIN_CHARS: number = Number(
  process.env.EXPO_PUBLIC_GEOCODER_MIN_CHARS ?? 3,
);
export const GEOCODER_DEBOUNCE_MS: number = Number(
  process.env.EXPO_PUBLIC_GEOCODER_DEBOUNCE_MS ?? 400,
);

const COMMON_DK = {
  countryCode: 'dk',
  language: 'da',
};

function userAgentHeader(): HeadersInit {
  return { 'User-Agent': 'PantmigNative/1.0 (geocoding)' };
}

export async function geocodeSearch(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  switch (provider) {
    case 'mapbox':
      return mapboxSearch(q);
    case 'opencage':
      return opencageSearch(q);
    case 'photon':
      return photonSearch(q);
    default:
      return nominatimSearch(q);
  }
}

export async function geocodeSuggest(query: string, limit = 5): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  switch (provider) {
    case 'mapbox':
      return mapboxSuggest(q, limit);
    case 'opencage':
      return opencageSuggest(q, limit);
    case 'photon':
      return photonSuggest(q, limit);
    default:
      return nominatimSuggest(q, limit);
  }
}

// Nominatim (OSM) — no key required, be mindful of rate limits and include UA.
async function nominatimSearch(q: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=${COMMON_DK.language}&countrycodes=${COMMON_DK.countryCode}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', ...userAgentHeader() } });
  const arr = await res.json();
  if (Array.isArray(arr) && arr[0]) {
    const lat = Number.parseFloat(arr[0].lat);
    const lon = Number.parseFloat(arr[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { display: String(arr[0].display_name || q), lat, lon };
    }
  }
  return null;
}

async function nominatimSuggest(q: string, limit: number): Promise<GeocodeResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&accept-language=${COMMON_DK.language}&countrycodes=${COMMON_DK.countryCode}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', ...userAgentHeader() } });
  const arr = await res.json();
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r: any) => ({ display: String(r.display_name), lat: Number.parseFloat(r.lat), lon: Number.parseFloat(r.lon) }))
    .filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}

// Mapbox Geocoding API
async function mapboxSearch(q: string): Promise<GeocodeResult | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(
    token,
  )}&limit=1&country=${COMMON_DK.countryCode}&language=${COMMON_DK.language}`;
  const res = await fetch(url);
  const json = await res.json();
  const feat = json?.features?.[0];
  if (!feat) return null;
  const coords = feat.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  const [lon, lat] = coords as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { display: String(feat.place_name || q), lat, lon };
}

async function mapboxSuggest(q: string, limit: number): Promise<GeocodeResult[]> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(
    token,
  )}&limit=${limit}&country=${COMMON_DK.countryCode}&language=${COMMON_DK.language}`;
  const res = await fetch(url);
  const json = await res.json();
  const feats = Array.isArray(json?.features) ? json.features : [];
  return feats
    .map((f: any) => {
      const coords = f.geometry?.coordinates;
  const [lon, lat] = Array.isArray(coords) ? (coords as [number, number]) : [Number.NaN, Number.NaN];
      return { display: String(f.place_name || q), lat, lon } as GeocodeResult;
    })
    .filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}

// OpenCage Geocoding API
async function opencageSearch(q: string): Promise<GeocodeResult | null> {
  const key = process.env.EXPO_PUBLIC_OPENCAGE_KEY;
  if (!key) return null;
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${encodeURIComponent(
    key,
  )}&limit=1&countrycode=${COMMON_DK.countryCode}&language=${COMMON_DK.language}`;
  const res = await fetch(url);
  const json = await res.json();
  const r = json?.results?.[0];
  if (!r) return null;
  const lat = Number(r.geometry?.lat);
  const lon = Number(r.geometry?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { display: String(r.formatted || q), lat, lon };
}

async function opencageSuggest(q: string, limit: number): Promise<GeocodeResult[]> {
  const key = process.env.EXPO_PUBLIC_OPENCAGE_KEY;
  if (!key) return [];
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${encodeURIComponent(
    key,
  )}&limit=${limit}&countrycode=${COMMON_DK.countryCode}&language=${COMMON_DK.language}`;
  const res = await fetch(url);
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];
  return results
    .map((r: any) => ({ display: String(r.formatted), lat: Number(r.geometry?.lat), lon: Number(r.geometry?.lng) }))
    .filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}

// Photon (Komoot) — OSM-based, no key; country filter not guaranteed on public instance.
async function photonSearch(q: string): Promise<GeocodeResult | null> {
  try {
    const sanitized = sanitizePhotonQuery(q);
    const lang = photonLanguage(COMMON_DK.language);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(sanitized)}&limit=1&lang=${lang}`;
    const res = await fetch(url);
    if (!res.ok) {
      return await nominatimSearch(q);
    }
    const json = await res.json();
    const feat = json?.features?.[0];
    if (!feat) return null;
    const coords = feat.geometry?.coordinates;
    if (!Array.isArray(coords)) return null;
    const [lon, lat] = coords as [number, number];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { display: photonLabel(feat) || q, lat, lon };
  } catch {
    return await nominatimSearch(q);
  }
}

async function photonSuggest(q: string, limit: number): Promise<GeocodeResult[]> {
  try {
    const sanitized = sanitizePhotonQuery(q);
    const lang = photonLanguage(COMMON_DK.language);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(sanitized)}&limit=${limit}&lang=${lang}`;
    const res = await fetch(url);
    if (!res.ok) {
      return await nominatimSuggest(q, limit);
    }
    const json = await res.json();
    const feats = Array.isArray(json?.features) ? json.features : [];
    return feats
      .map((f: any) => {
        const coords = f.geometry?.coordinates;
        const [lon, lat] = Array.isArray(coords) ? (coords as [number, number]) : [Number.NaN, Number.NaN];
        return { display: photonLabel(f), lat, lon } as GeocodeResult;
      })
      .filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  } catch {
    return await nominatimSuggest(q, limit);
  }
}

function photonLabel(f: any): string {
  const p = f?.properties || {};
  const parts = [p.name, p.street, p.housenumber, p.city, p.country].filter(Boolean);
  return parts.join(', ');
}

// Photon supports: default, en, de, fr. Map unsupported to a safe default.
function photonLanguage(requested: string): 'default' | 'en' | 'de' | 'fr' {
  const lower = (requested || '').toLowerCase();
  if (lower === 'en' || lower === 'de' || lower === 'fr') return lower as any;
  return 'default';
}
