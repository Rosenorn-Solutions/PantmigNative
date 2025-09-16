// Simple in-memory cache for user info across the app session
// Stores username and rating keyed by user id.

export type CachedUserInfo = {
  userName?: string;
  rating?: number;
  // reserved for future TTL, if needed
  // ts?: number;
};

const cache = new Map<string, CachedUserInfo>();

export function getUserFromCache(id: string): CachedUserInfo | undefined {
  return cache.get(id);
}

export function setUserInCache(id: string, info: CachedUserInfo): void {
  const prev = cache.get(id) || {};
  cache.set(id, { ...prev, ...info });
}

export function getManyUsersFromCache(ids: string[]): Record<string, CachedUserInfo> {
  const out: Record<string, CachedUserInfo> = {};
  for (const id of ids) {
    const v = cache.get(id);
    if (v) out[id] = { ...v };
  }
  return out;
}

export function setManyUsersInCache(entries: Record<string, CachedUserInfo>): void {
  for (const [id, info] of Object.entries(entries)) {
    setUserInCache(id, info);
  }
}

// Accepts users array from batch lookup; supports both legacy { id, rating }
// and new shape that may include { userName }.
export function mergeBatchIntoCache(users: Array<any> | null | undefined): void {
  if (!users) return;
  for (const u of users) {
    if (!u?.id) continue;
    const info: CachedUserInfo = {};
    if (typeof u.rating === 'number') info.rating = u.rating;
    if (typeof u.userName === 'string' && u.userName) info.userName = u.userName;
    if (Object.keys(info).length > 0) setUserInCache(u.id, info);
  }
}

export function getMissingIds(ids: string[], need: { userName?: boolean; rating?: boolean }): string[] {
  return ids.filter((id) => {
    const v = cache.get(id);
    if (!v) return true;
    if (need.userName && !v.userName) return true;
    if (need.rating && typeof v.rating !== 'number') return true;
    return false;
  });
}
