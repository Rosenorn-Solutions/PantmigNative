import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationsApi } from '../apis/pantmig-api/apis/NotificationsApi';
import { RecycleListingsApi } from '../apis/pantmig-api/apis/RecycleListingsApi';
import { StatisticsApi } from '../apis/pantmig-api/apis/StatisticsApi';
import { Configuration as ApiConfig } from '../apis/pantmig-api/runtime';
import { AuthApi } from '../apis/pantmig-auth/apis/AuthApi';
import { AuthResponse } from '../apis/pantmig-auth/models/AuthResponse';
import { TokenRefreshRequest } from '../apis/pantmig-auth/models/TokenRefreshRequest';
import { Configuration as AuthConfig, ErrorContext, Middleware, RequestContext } from '../apis/pantmig-auth/runtime';
import { API_BASE, AUTH_BASE, PROD_API_BASE, PROD_AUTH_BASE } from '../config';
import { publishLogout, publishRefreshStart, publishTokensUpdated, waitForTokensUpdated } from './authSync';

function mergeHeaders(existing: HeadersInit | undefined, extra: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (existing) {
    if (existing instanceof Headers) {
      for (const [k, v] of existing.entries()) { out[k] = v; }
    } else if (Array.isArray(existing)) {
      for (const [k, v] of existing) out[k] = String(v);
    } else {
      Object.assign(out, existing as any);
    }
  }
  return { ...out, ...extra };
}

// Two separate, configurable base URLs
// Priority: explicit config vars -> process env explicit base -> production domains -> legacy localhost defaults
const apiBasePath = API_BASE || process.env.EXPO_PUBLIC_API_BASE || PROD_API_BASE || 'http://localhost:5001';
const authBasePath = AUTH_BASE || process.env.EXPO_PUBLIC_AUTH_BASE || PROD_AUTH_BASE || 'http://localhost:5002';

// Log resolved base paths once for debugging
// These logs help diagnose emulator/host connectivity issues
try {
  // eslint-disable-next-line no-console
  console.log('[API] Base paths ->', { apiBasePath, authBasePath });
} catch {}

async function getTokens() {
  const access = await AsyncStorage.getItem('token');
  const refresh = await AsyncStorage.getItem('refreshToken');
  return { access, refresh };
}

async function saveAuth(resp: AuthResponse) {
  const access = resp.accessToken ?? '';
  const refresh = resp.refreshToken ?? '';
  await AsyncStorage.setItem('token', access);
  await AsyncStorage.setItem('refreshToken', refresh);
  try {
    const exp = resp.accessTokenExpiration ? new Date(resp.accessTokenExpiration).toISOString() : '';
    if (exp) await AsyncStorage.setItem('tokenExpiresAt', exp);
  } catch {}
}

let authSyncListener: ((resp: AuthResponse) => void) | null = null;
export const setAuthSyncListener = (listener: ((resp: AuthResponse) => void) | null) => {
  authSyncListener = listener;
};

let refreshInFlight: Promise<AuthResponse | null> | null = null;

async function refreshTokens(access: string | null, refresh: string | null): Promise<AuthResponse | null> {
  if (!refresh) return null;
  // If a refresh is already running in this context wait for it
  if (refreshInFlight) return refreshInFlight;
  publishRefreshStart();
  const runner = (async () => {
    try {
      const authApiLocal = new AuthApi(new AuthConfig({ basePath: authBasePath }));
      const refreshed = await authApiLocal.authRefresh({ tokenRefreshRequest: { accessToken: access ?? '', refreshToken: refresh } as TokenRefreshRequest });
      await saveAuth(refreshed);
      publishTokensUpdated(refreshed);
      if (authSyncListener) authSyncListener(refreshed);
      return refreshed;
    } catch (error_: any) {
      // Distinguish 400 invalid/expired refresh vs other errors if possible
      const maybeStatus = error_?.status ?? error_?.cause?.status;
      const message = error_?.body?.title || error_?.message || '';
      // Attempt one late re-sync by waiting for another context's success
      const external = await waitForTokensUpdated(2000);
      if (external?.accessToken) {
        await saveAuth(external);
        if (authSyncListener) authSyncListener(external);
        return external;
      }
      try {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('tokenExpiresAt');
      } catch (error__) {
        // eslint-disable-next-line no-console
        console.warn('Failed to clean up auth tokens after refresh failure', error__);
      }
      publishLogout(maybeStatus === 400 ? 'invalid-refresh-token' : 'refresh-failed');
      // eslint-disable-next-line no-console
      console.warn('Token refresh failed', maybeStatus, message);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  refreshInFlight = runner;
  return runner;
}

const authMiddleware: Middleware = {
  pre: async (ctx: RequestContext) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[HTTP]', (ctx.init as any)?.method || 'GET', ctx.url);
    } catch {}
    const lowerUrl = (ctx.url || '').toLowerCase();
    const isAuthPublic = lowerUrl.includes('/auth/login') || lowerUrl.includes('/auth/register') || lowerUrl.includes('/auth/refresh');
    if (!isAuthPublic) {
      let { access, refresh } = await getTokens();
      try {
        const expIso = await AsyncStorage.getItem('tokenExpiresAt');
        if (expIso) {
          const msLeft = new Date(expIso).getTime() - Date.now();
          // Refresh proactively if <= 60s remaining
          if (msLeft <= 60_000) {
            const refreshed = await refreshTokens(access, refresh);
            if (refreshed?.accessToken) access = refreshed.accessToken ?? access;
          }
        }
      } catch {
        // ignore clock parse issues
      }
      if (access) ctx.init.headers = mergeHeaders(ctx.init.headers, { Authorization: `Bearer ${access}` }) as any;
    }
    return { url: ctx.url, init: ctx.init };
  },
  onError: async (ctx: ErrorContext) => {
    try {
      // eslint-disable-next-line no-console
      console.error('[HTTP ERROR]', ctx.url, ctx.error);
    } catch {}
    const res = ctx.response;
  if (res?.status === 401) {
      const { access, refresh } = await getTokens();
      const refreshed = await refreshTokens(access, refresh);
      if (refreshed?.accessToken) {
        const newAccess = refreshed.accessToken ?? '';
        const retryInit: RequestInit = { ...ctx.init, headers: mergeHeaders(ctx.init.headers, { Authorization: `Bearer ${newAccess}` }) } as any;
        return await fetch(ctx.url, retryInit);
      }
    }
    // If we reach here and response was 401, publishLogout already called in refreshTokens failure path
    return undefined;
  },
};

// Shared API instances
export const authApi = new AuthApi(new AuthConfig({ basePath: authBasePath, middleware: [authMiddleware] }));
export const pantmigApiConfig = new ApiConfig({ basePath: apiBasePath, middleware: [authMiddleware] });

// Helper to create domain APIs already wired
export const createRecycleListingsApi = () => new RecycleListingsApi(pantmigApiConfig);
export const createNotificationsApi = () => new NotificationsApi(pantmigApiConfig);
export const createStatisticsApi = () => new StatisticsApi(pantmigApiConfig);

// Ensure we return a fresh access token; performs proactive refresh when <=60s left
export async function ensureFreshAccessToken(): Promise<string | null> {
  const { access, refresh } = await getTokens();
  if (!access) return null;
  try {
    const expIso = await AsyncStorage.getItem('tokenExpiresAt');
    if (expIso) {
      const msLeft = new Date(expIso).getTime() - Date.now();
      if (msLeft <= 60_000) {
        const refreshed = await refreshTokens(access, refresh);
        if (refreshed?.accessToken) return refreshed.accessToken ?? null;
      }
    }
  } catch {
    // ignore parse errors
  }
  return access;
}

// Multipart helper with automatic bearer injection + single refresh retry
export async function authorizedMultipart(path: string, form: FormData, options?: { method?: 'POST' | 'PUT' | 'PATCH'; signal?: AbortSignal; }): Promise<Response> {
  const method = options?.method || 'POST';
  const { access, refresh } = await getTokens();
  const url = `${apiBasePath}${path.startsWith('/') ? path : '/' + path}`;
  const headers: Record<string, string> = {};
  if (access) headers['Authorization'] = `Bearer ${access}`;
  let response = await fetch(url, { method, body: form, headers, signal: options?.signal });
  if (response.status === 401 && refresh) {
    const refreshed = await refreshTokens(access, refresh);
    if (refreshed?.accessToken) {
      const retryHeaders: Record<string, string> = { Authorization: `Bearer ${refreshed.accessToken}` };
      response = await fetch(url, { method, body: form, headers: retryHeaders, signal: options?.signal });
      if (response.ok && authSyncListener) {
        // authSyncListener already invoked inside refreshTokens; nothing further needed
      }
    }
  }
  return response;
}

// Lightweight authorized JSON helpers for endpoints not modeled in OpenAPI (or returning unknown JSON)
export async function authorizedGetJson<T = any>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
  const { access, refresh } = await getTokens();
  const url = `${apiBasePath}${path.startsWith('/') ? path : '/' + path}`;
  const headers: Record<string, string> = {};
  if (access) headers['Authorization'] = `Bearer ${access}`;
  let response = await fetch(url, { method: 'GET', headers, signal: options?.signal });
  if (response.status === 401 && refresh) {
    const refreshed = await refreshTokens(access, refresh);
    if (refreshed?.accessToken) {
      const retryHeaders: Record<string, string> = { Authorization: `Bearer ${refreshed.accessToken}` };
      response = await fetch(url, { method: 'GET', headers: retryHeaders, signal: options?.signal });
    }
  }
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return await response.json();
}

export async function authorizedPostJson<T = any>(path: string, body: any, options?: { signal?: AbortSignal }): Promise<T> {
  const { access, refresh } = await getTokens();
  const url = `${apiBasePath}${path.startsWith('/') ? path : '/' + path}`;
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (access) baseHeaders['Authorization'] = `Bearer ${access}`;
  let response = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: baseHeaders, signal: options?.signal });
  if (response.status === 401 && refresh) {
    const refreshed = await refreshTokens(access, refresh);
    if (refreshed?.accessToken) {
      const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshed.accessToken}` };
      response = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: retryHeaders, signal: options?.signal });
    }
  }
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await response.json();
  // Some endpoints may return 204 No Content
  return undefined as unknown as T;
}
