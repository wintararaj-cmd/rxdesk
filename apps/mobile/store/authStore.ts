import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { UserRole } from '@rxdesk/shared';

interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  is_verified: boolean;
  is_profile_complete?: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrateAuth: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = 'rxdesk_access_token';
const REFRESH_TOKEN_KEY = 'rxdesk_refresh_token';
const USER_KEY = 'rxdesk_user';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isLoading: false,
  isHydrated: false,

  setTokens: async (accessToken, refreshToken) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
    set({ accessToken });
  },

  setUser: async (user) => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  clearAuth: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    set({ accessToken: null, user: null });
  },

  hydrateAuth: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      const user: AuthUser | null = userJson ? JSON.parse(userJson) : null;
      set({ accessToken: token ?? null, user, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },
}));

export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
