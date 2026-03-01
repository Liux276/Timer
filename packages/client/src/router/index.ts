import { authApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { createRouter, createWebHistory } from 'vue-router';

// Cache setup status briefly to avoid duplicate requests during rapid navigation.
let setupStatusCache: boolean | null = null;
let setupStatusCheckedAt: number | null = null;
const SETUP_STATUS_TTL_MS = 5000;
const SETUP_STATUS_MAX_RETRIES = 3;
const SETUP_STATUS_RETRY_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkNeedsSetup(): Promise<boolean | null> {
  if (
    setupStatusCache !== null
    && setupStatusCheckedAt !== null
    && Date.now() - setupStatusCheckedAt < SETUP_STATUS_TTL_MS
  ) {
    return setupStatusCache;
  }

  for (let i = 0; i < SETUP_STATUS_MAX_RETRIES; i++) {
    try {
      const { data } = await authApi.setupStatus();
      setupStatusCache = data.needsSetup;
      setupStatusCheckedAt = Date.now();
      return data.needsSetup;
    } catch {
      if (i < SETUP_STATUS_MAX_RETRIES - 1) {
        await sleep(SETUP_STATUS_RETRY_DELAY_MS);
      }
    }
  }

  // Unknown status: do not fall back to "already set up".
  return null;
}

/** Call after first admin is created to clear the cache */
export function clearSetupCache(): void {
  setupStatusCache = null;
  setupStatusCheckedAt = null;
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/SetupView.vue'),
      meta: { public: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/setup-status-error',
      name: 'setup-status-error',
      component: () => import('@/views/SetupStatusErrorView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      redirect: '/iterations',
    },
    {
      path: '/iterations',
      name: 'iterations',
      component: () => import('@/views/IterationsView.vue'),
    },
    {
      path: '/iterations/:id',
      name: 'iteration-detail',
      component: () => import('@/views/IterationsView.vue'),
    },
    {
      path: '/requirements',
      name: 'requirements',
      component: () => import('@/views/RequirementsView.vue'),
    },
    {
      path: '/requirements/:id',
      name: 'task-detail',
      component: () => import('@/views/TaskDetailView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/AdminUsersView.vue'),
      meta: { admin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/',
    },
  ],
});

if (typeof window !== 'undefined') {
  window.addEventListener('focus', clearSetupCache);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearSetupCache();
    }
  });
}

// Auth guard
router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const needsSetup = await checkNeedsSetup();

  if (needsSetup === null) {
    if (to.name === 'setup-status-error') {
      return true;
    }
    return {
      name: 'setup-status-error',
      query: { redirect: to.fullPath },
    };
  }

  if (to.name === 'setup-status-error') {
    const redirectTarget = typeof to.query.redirect === 'string' ? to.query.redirect : '/';
    return { path: redirectTarget };
  }

  // If system needs initial setup, redirect everywhere to /setup
  if (needsSetup && to.name !== 'setup') {
    return { name: 'setup' };
  }
  // If system is already set up, block /setup
  if (!needsSetup && to.name === 'setup') {
    return { name: 'login' };
  }

  const isPublic = to.meta.public === true;

  if (isPublic) {
    if (to.name === 'login') {
      const status = await authStore.ensureSession();
      if (status === 'authenticated') {
        return { path: '/' };
      }
    }
    return true;
  }

  const sessionStatus = await authStore.ensureSession();

  if (sessionStatus === 'unauthenticated') {
    return { name: 'login' };
  }

  if (sessionStatus === 'server_unreachable') {
    return {
      name: 'setup-status-error',
      query: { redirect: to.fullPath },
    };
  }

  // Admin route guard
  if (to.meta.admin === true) {
    try {
      const saved = localStorage.getItem('user');
      const user = saved ? JSON.parse(saved) : null;
      if (user?.role !== 'admin') {
        return { path: '/' };
      }
    } catch {
      return { path: '/' };
    }
  }
});

export default router;
