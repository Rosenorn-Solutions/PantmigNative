// Cross-context auth coordination for web (BroadcastChannel) with safe fallbacks for native.
// Responsibilities:
// - Broadcast token refresh start/success
// - Broadcast logout events
// - Allow listeners to react (e.g., update AuthContext) and allow single-flight style waiting

import type { AuthResponse } from '../apis/pantmig-auth/models/AuthResponse';

export type AuthBroadcastMessage =
  | { type: 'refresh-start'; ts: number }
  | { type: 'tokens-updated'; ts: number; payload: AuthResponse }
  | { type: 'logout'; ts: number; reason?: string };

type Unsubscribe = () => void;

const CHANNEL_NAME = 'pantmig_auth';

// Lazy channel creation to avoid issues in non-web environments
let channel: BroadcastChannel | null = null;
let localListeners: Array<(m: AuthBroadcastMessage) => void> = [];

function getChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel ??= new BroadcastChannel(CHANNEL_NAME);
      return channel;
    }
  } catch {}
  return null;
}

export function publishRefreshStart(): void {
  const msg: AuthBroadcastMessage = { type: 'refresh-start', ts: Date.now() };
  const ch = getChannel();
  if (ch) ch.postMessage(msg);
  for (const l of localListeners) l(msg);
}

export function publishTokensUpdated(resp: AuthResponse): void {
  const msg: AuthBroadcastMessage = { type: 'tokens-updated', ts: Date.now(), payload: resp };
  const ch = getChannel();
  if (ch) ch.postMessage(msg);
  for (const l of localListeners) l(msg);
}

export function publishLogout(reason?: string): void {
  const msg: AuthBroadcastMessage = { type: 'logout', ts: Date.now(), reason };
  const ch = getChannel();
  if (ch) ch.postMessage(msg);
  for (const l of localListeners) l(msg);
}

export function subscribeAuthBroadcast(cb: (msg: AuthBroadcastMessage) => void): Unsubscribe {
  const ch = getChannel();
  if (ch) {
    const handler = (ev: MessageEvent<AuthBroadcastMessage>) => cb(ev.data);
    ch.addEventListener('message', handler as EventListener);
    // Keep a local listener for native fallback as well
    localListeners.push(cb);
    return () => {
      try { ch.removeEventListener('message', handler as EventListener); } catch {}
      localListeners = localListeners.filter((l) => l !== cb);
    };
  }
  // Fallback: local listeners only (same context)
  localListeners.push(cb);
  return () => { localListeners = localListeners.filter((l) => l !== cb); };
}

// Utility to await a tokens-updated message for a short time window.
export function waitForTokensUpdated(timeoutMs = 5000): Promise<AuthResponse | null> {
  return new Promise<AuthResponse | null>((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) { done = true; unsub(); resolve(null); }
    }, timeoutMs);
    const unsub = subscribeAuthBroadcast((msg) => {
      if (done) return;
      if (msg.type === 'tokens-updated') {
        done = true;
        clearTimeout(timeout);
        unsub();
        resolve(msg.payload);
      }
    });
  });
}
