import { authApi } from '@/api';
import type { User } from '@/types';
import axios from 'axios';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated' | 'server_unreachable';

const SESSION_RECHECK_TTL_MS = 5000;

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(loadUser());
  const token = ref<string | null>(localStorage.getItem('token'));
  const sessionStatus = ref<SessionStatus>(token.value ? 'unknown' : 'unauthenticated');
  const sessionCheckedAt = ref<number | null>(null);

  const isLoggedIn = computed(() => sessionStatus.value === 'authenticated');
  const isAdmin = computed(() => user.value?.role === 'admin');

  function loadUser(): User | null {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return null;
  }

  function setAuth(t: string, u: User) {
    token.value = t;
    user.value = u;
    sessionStatus.value = 'authenticated';
    sessionCheckedAt.value = Date.now();
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
  }

  async function login(username: string, password: string) {
    const { data } = await authApi.login(username, password);
    setAuth(data.token, data.user);
  }

  async function setup(username: string, password: string, displayName?: string) {
    const { data } = await authApi.setup(username, password, displayName);
    setAuth(data.token, data.user);
  }

  async function fetchMe() {
    try {
      const { data } = await authApi.me();
      user.value = data;
      sessionStatus.value = 'authenticated';
      sessionCheckedAt.value = Date.now();
      localStorage.setItem('user', JSON.stringify(data));
    } catch {
      logout();
    }
  }

  function markServerUnreachable() {
    if (token.value || localStorage.getItem('token')) {
      sessionStatus.value = 'server_unreachable';
    } else {
      sessionStatus.value = 'unauthenticated';
    }
    sessionCheckedAt.value = Date.now();
  }

  async function ensureSession(): Promise<SessionStatus> {
    const now = Date.now();
    const currentToken = token.value || localStorage.getItem('token');

    if (!currentToken) {
      token.value = null;
      user.value = null;
      sessionStatus.value = 'unauthenticated';
      sessionCheckedAt.value = now;
      return sessionStatus.value;
    }

    token.value = currentToken;

    if (sessionCheckedAt.value && now - sessionCheckedAt.value < SESSION_RECHECK_TTL_MS) {
      if (sessionStatus.value === 'authenticated' || sessionStatus.value === 'server_unreachable') {
        return sessionStatus.value;
      }
    }

    try {
      const { data } = await authApi.me();
      user.value = data;
      sessionStatus.value = 'authenticated';
      sessionCheckedAt.value = Date.now();
      localStorage.setItem('user', JSON.stringify(data));
      return sessionStatus.value;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401 || status === 404) {
          logout();
          sessionStatus.value = 'unauthenticated';
          sessionCheckedAt.value = Date.now();
          return sessionStatus.value;
        }
        if (!error.response) {
          markServerUnreachable();
          return sessionStatus.value;
        }
      }
      markServerUnreachable();
      return sessionStatus.value;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    sessionStatus.value = 'unauthenticated';
    sessionCheckedAt.value = Date.now();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return {
    user,
    token,
    isLoggedIn,
    isAdmin,
    sessionStatus,
    sessionCheckedAt,
    login,
    setup,
    fetchMe,
    ensureSession,
    markServerUnreachable,
    logout,
  };
});
