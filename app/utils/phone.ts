export function normalizePhoneDK(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  let digits = raw.replaceAll(/\D/g, '');
  if (digits.startsWith('0045')) digits = digits.slice(4);
  if (digits.startsWith('45')) digits = digits.slice(2);
  // Prefer last 8 digits if user pasted with extra characters
  let local = digits;
  if (digits.length >= 8) local = digits.slice(-8);
  return `+45${local}`;
}

/**
 * Format a local Danish number as `12 34 56 78` for display while typing.
 * Keeps only digits, caps at 8, and inserts spaces every 2 digits.
 */
export function formatPhoneDKLocalDisplay(input: string): string {
  const digits = (input || '').replaceAll(/\D/g, '').slice(0, 8);
  return digits.replaceAll(/(\d{2})(?=\d)/g, '$1 ').trim();
}
