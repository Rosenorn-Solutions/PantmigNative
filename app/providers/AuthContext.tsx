import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AuthResponse } from '../apis/pantmig-auth/models/AuthResponse';
import type { TokenRefreshRequest } from '../apis/pantmig-auth/models/TokenRefreshRequest';
import { UserType as ApiUserType } from '../apis/pantmig-auth/models/UserType';
import { authApi, setAuthSyncListener } from '../services/api';
import { publishLogout, subscribeAuthBroadcast } from '../services/authSync';
import { useToast } from './ToastProvider';

const AuthContext = createContext(null);

type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: 'Donator' | 'Recycler';
  userType?: number;
  cityExternalId?: string | null;
  cityName?: string | null;
  gender?: number | null; // 0 Unknown, 1 Male, 2 Female
  birthDate?: string | null; // Stored as YYYY-MM-DD (DateOnly)
  // Add other fields from AuthResponse as needed
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  setAuthFromResponse: (resp: AuthResponse) => Promise<void>;
  updateTokens: (accessToken: string | null, refreshToken: string | null) => Promise<void>;
};

const AuthContextTyped = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);
  const { show } = useToast();

  useEffect(() => {
    const rehydrateUserWithMe = async () => {
      try {
        const me = await authApi.authMe();
        const birthDateStr = me.birthDate ? new Date(me.birthDate as any).toISOString().substring(0, 10) : null;
        setUser({
          id: me.id ?? '',
          email: me.email ?? '',
          firstName: me.firstName ?? '',
          lastName: me.lastName ?? '',
          role: undefined,
          userType: undefined,
          cityExternalId: (me as any).cityExternalId ?? null,
          cityName: me.cityName ?? null,
          gender: (me.gender as number | undefined) ?? null,
          birthDate: birthDateStr,
        });
      } catch {
        await logout();
      }
    };

    const loadUser = async () => {
      const [savedToken, savedUser, savedRefresh, savedExp] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('refreshToken'),
        AsyncStorage.getItem('tokenExpiresAt'),
      ]);
      if (savedToken) setToken(savedToken);
      if (savedRefresh) setRefreshToken(savedRefresh);
      if (savedExp) setExpiresAt(savedExp);
      if (savedToken) {
        if (savedUser) { try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ } }
        else { await rehydrateUserWithMe(); }
      }
      setLoading(false);
    };
    loadUser();
    // keep context in sync when middleware refreshes tokens
    setAuthSyncListener(async (resp: AuthResponse) => {
      await setAuthFromResponse(resp);
    });
    const unsub = subscribeAuthBroadcast(async (msg) => {
      if (msg.type === 'tokens-updated') {
        await setAuthFromResponse(msg.payload);
      } else if (msg.type === 'logout') {
        // Prevent broadcast loops: clear locally without emitting another logout event
        await clearAuth(false);
      }
    });
    return () => { setAuthSyncListener(null); unsub(); };
  }, []);

  useEffect(() => {
    scheduleRefresh(expiresAt);
  }, [expiresAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        tryProactiveRefresh();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  const scheduleRefresh = (iso?: string | null) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!iso) return;
  const when = new Date(iso).getTime() - Date.now() - 60_000;
    if (when <= 0) {
      // Already expired or close to expiry, trigger now
      tryProactiveRefresh();
      return;
    }
    refreshTimerRef.current = setTimeout(() => tryProactiveRefresh(), when);
  };

  const tryProactiveRefresh = async () => {
    const currentToken = await AsyncStorage.getItem('token');
    const currentRefresh = await AsyncStorage.getItem('refreshToken');
    if (!currentRefresh) return;
    const expIso = await AsyncStorage.getItem('tokenExpiresAt');
    if (expIso) {
      const msLeft = new Date(expIso).getTime() - Date.now();
  if (msLeft > 2 * 60_000) return;
    }
    try {
      const result = await authApi.authRefresh({ tokenRefreshRequest: { accessToken: currentToken ?? '', refreshToken: currentRefresh } as TokenRefreshRequest });
      if (result?.accessToken) {
        await setAuthFromResponse(result);
      }
    } catch {
      show('Session expired. Please log in again.', 'error', 3500);
      await logout();
    }
  };

  const login = async (email: string, password: string) => {
    // Backend now accepts either email or username via `emailOrUsername`
    const result = await authApi.authLogin({ loginRequest: { emailOrUsername: email, password } });
    if (result?.authResponse?.accessToken) {
      await setAuthFromResponse(result.authResponse);
    }
    return result;
  };

  const clearAuth = async (broadcast: boolean) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setToken(null);
    setUser(null);
    setRefreshToken(null);
    setExpiresAt(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('tokenExpiresAt');
    if (broadcast) publishLogout('manual');
  };

  const logout = async () => {
    await clearAuth(true);
  };

  const setAuthFromResponse = async (resp: AuthResponse) => {
    const access = resp.accessToken ?? '';
    const refresh = resp.refreshToken ?? '';
    const expIso = resp.accessTokenExpiration ? new Date(resp.accessTokenExpiration).toISOString() : null;
    let role: 'Donator' | 'Recycler' | undefined = user?.role;
    if (resp.userType === ApiUserType.NUMBER_0) role = 'Donator';
    else if (resp.userType === ApiUserType.NUMBER_1) role = 'Recycler';
    // Normalize birthDate (DateOnly) to YYYY-MM-DD; backend sends date (no time) but generator wraps as Date.
    let birthDateStr: string | null | undefined = user?.birthDate ?? null;
    try {
      if (resp.birthDate) {
        const d = new Date(resp.birthDate as any);
        if (!Number.isNaN(d.getTime())) {
          birthDateStr = d.toISOString().substring(0, 10);
        }
      }
    } catch {}
    const usr = {
      id: resp.userId ?? user?.id ?? '',
      email: resp.email ?? user?.email ?? '',
      firstName: resp.firstName ?? user?.firstName ?? '',
      lastName: resp.lastName ?? user?.lastName ?? '',
      role,
      userType: (resp.userType as number | undefined) ?? user?.userType,
      cityExternalId: (resp as any).cityExternalId ?? user?.cityExternalId ?? null,
      cityName: resp.cityName ?? user?.cityName ?? null,
      gender: (resp.gender as number | undefined) ?? user?.gender ?? null,
      birthDate: birthDateStr ?? null,
    };
    setToken(access);
    setRefreshToken(refresh);
    setExpiresAt(expIso);
    setUser(usr);
    await AsyncStorage.setItem('token', access);
    await AsyncStorage.setItem('refreshToken', refresh);
    await AsyncStorage.setItem('user', JSON.stringify(usr));
    if (expIso) await AsyncStorage.setItem('tokenExpiresAt', expIso); else await AsyncStorage.removeItem('tokenExpiresAt');
    scheduleRefresh(expIso);
  };

  const updateTokens = async (access: string | null, refresh: string | null) => {
    setToken(access);
    setRefreshToken(refresh);
    if (access) await AsyncStorage.setItem('token', access); else await AsyncStorage.removeItem('token');
    if (refresh) await AsyncStorage.setItem('refreshToken', refresh); else await AsyncStorage.removeItem('refreshToken');
  };

  const value = useMemo(() => ({ user, token, refreshToken, loading, login, logout, setAuthFromResponse, updateTokens }), [user, token, refreshToken, loading]);

  return (
  <AuthContextTyped.Provider value={value}>
      {children}
    </AuthContextTyped.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContextTyped);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};