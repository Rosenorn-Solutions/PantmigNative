import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse } from './apis/pantmig-auth/models/AuthResponse';
import { UserType as ApiUserType } from './apis/pantmig-auth/models/UserType';
import { authApi, setAuthSyncListener } from './services/api';

const AuthContext = createContext(null);

type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: 'Donator' | 'Recycler';
  userType?: number;
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

  useEffect(() => {
    const loadUser = async () => {
      const savedToken = await AsyncStorage.getItem('token');
      const savedUser = await AsyncStorage.getItem('user');
      const savedRefresh = await AsyncStorage.getItem('refreshToken');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
      if (savedRefresh) {
        setRefreshToken(savedRefresh);
      }
      setLoading(false);
    };
    loadUser();
  // keep context in sync when middleware refreshes tokens
  setAuthSyncListener(async (resp: AuthResponse) => {
      await setAuthFromResponse(resp);
    });
    return () => setAuthSyncListener(null);
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authApi.authLogin({ loginRequest: { email, password } });
    if (result?.authResponse?.accessToken) {
      await setAuthFromResponse(result.authResponse);
    }
    return result;
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setRefreshToken(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
  };

  const setAuthFromResponse = async (resp: AuthResponse) => {
    const access = resp.accessToken ?? '';
    const refresh = resp.refreshToken ?? '';
    let role: 'Donator' | 'Recycler' | undefined = user?.role;
    if (resp.userType === ApiUserType.NUMBER_0) role = 'Donator';
    else if (resp.userType === ApiUserType.NUMBER_1) role = 'Recycler';
    const usr = {
      id: resp.userId ?? user?.id ?? '',
      email: resp.email ?? user?.email ?? '',
      firstName: resp.firstName ?? user?.firstName ?? '',
      lastName: resp.lastName ?? user?.lastName ?? '',
      role,
      userType: (resp.userType as number | undefined) ?? user?.userType,
    };
    setToken(access);
    setRefreshToken(refresh);
    setUser(usr);
    await AsyncStorage.setItem('token', access);
    await AsyncStorage.setItem('refreshToken', refresh);
    await AsyncStorage.setItem('user', JSON.stringify(usr));
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
