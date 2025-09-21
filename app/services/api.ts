import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecycleListingsApi } from '../apis/pantmig-api/apis/RecycleListingsApi';
import { Configuration as ApiConfig } from '../apis/pantmig-api/runtime';
import { AuthApi } from '../apis/pantmig-auth/apis/AuthApi';
import { AuthResponse } from '../apis/pantmig-auth/models/AuthResponse';
import { TokenRefreshRequest } from '../apis/pantmig-auth/models/TokenRefreshRequest';
import { Configuration as AuthConfig, ErrorContext, Middleware, RequestContext } from '../apis/pantmig-auth/runtime';
import { API_BASE, AUTH_BASE } from '../config';

// Two separate, configurable base URLs
// Priority: local config.ts -> EXPO_PUBLIC_* env -> sane defaults
const apiBasePath = API_BASE || process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:5001';
const authBasePath = AUTH_BASE || process.env.EXPO_PUBLIC_AUTH_BASE || 'http://localhost:5002';

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
}

let authSyncListener: ((resp: AuthResponse) => void) | null = null;
export const setAuthSyncListener = (listener: ((resp: AuthResponse) => void) | null) => {
  authSyncListener = listener;
};

const authMiddleware: Middleware = {
  pre: async (ctx: RequestContext) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[HTTP]', (ctx.init as any)?.method || 'GET', ctx.url);
    } catch {}
    const lowerUrl = (ctx.url || '').toLowerCase();
    const isAuthPublic = lowerUrl.includes('/auth/login') || lowerUrl.includes('/auth/register') || lowerUrl.includes('/auth/refresh');
    if (!isAuthPublic) {
      const { access } = await getTokens();
      if (access) {
        ctx.init.headers = { ...(ctx.init.headers || {}), Authorization: `Bearer ${access}` } as any;
      }
    }
    return { url: ctx.url, init: ctx.init };
  },
  onError: async (ctx: ErrorContext) => {
    try {
      // eslint-disable-next-line no-console
      console.error('[HTTP ERROR]', ctx.url, ctx.error);
    } catch {}
    const res = ctx.response;
    if (res && res.status === 401) {
      const { access, refresh } = await getTokens();
      if (refresh) {
        try {
          const authApi = new AuthApi(new AuthConfig({ basePath: authBasePath }));
          const refreshed = await authApi.authRefresh({ tokenRefreshRequest: { accessToken: access ?? '', refreshToken: refresh } as TokenRefreshRequest });
          await saveAuth(refreshed);
          if (authSyncListener) authSyncListener(refreshed);
          // retry original request with new access token
          const newAccess = refreshed.accessToken ?? '';
          const retryInit: RequestInit = { ...ctx.init, headers: { ...(ctx.init.headers || {}), Authorization: `Bearer ${newAccess}` } } as any;
          return await fetch(ctx.url, retryInit);
        } catch (e) {
          console.error('Token refresh failed', e);
        }
      }
    }
    return undefined;
  },
};

// Shared API instances
export const authApi = new AuthApi(new AuthConfig({ basePath: authBasePath, middleware: [authMiddleware] }));
export const pantmigApiConfig = new ApiConfig({ basePath: apiBasePath, middleware: [authMiddleware] });

// Helper to create domain APIs already wired
export const createRecycleListingsApi = () => new RecycleListingsApi(pantmigApiConfig);
