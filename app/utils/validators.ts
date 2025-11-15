export function isValidEmail(email: string): boolean {
  const e = (email || '').trim();
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
