'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  phone: string;
  role: string;
  is_profile_complete?: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => {
        // Set cookie so the Next.js middleware can detect authentication
        document.cookie = `rxdesk-access-token=${accessToken}; path=/; max-age=900; SameSite=Strict`;
        set({ accessToken, refreshToken });
      },
      setUser: (user) => set({ user }),
      clearAuth: () => {
        // Remove the auth cookie
        document.cookie = 'rxdesk-access-token=; path=/; max-age=0; SameSite=Strict';
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: 'rxdesk-web-auth' }
  )
);
