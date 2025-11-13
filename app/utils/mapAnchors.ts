export type AnchorSource = 'gps' | 'city' | 'default';

export function buildOverlayPrimaryText(source: AnchorSource, label: string) {
  if (source === 'gps') return 'Opslag tæt på dig';
  if (source === 'city') return `Opslag i nærheden af ${label}`;
  return 'Opslag i Danmark';
}

export function buildOverlaySecondaryText(source: AnchorSource) {
  if (source === 'gps') return 'Filtrerer opslag inden for ca. 5 km fra din position.';
  if (source === 'city') return 'Ingen GPS-adgang – bruger din registrerede by som udgangspunkt.';
  return 'Ingen koordinater tilgængelige, viser standardkort.';
}
