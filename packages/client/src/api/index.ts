import router from '@/router';
import type {
    AuthResponse,
    BackupConfig,
    BurndownData,
    CreateUserPayload,
    Iteration,
    SetupStatus,
    Task,
    TaskFilter,
    User,
    WorkloadStats,
} from '@/types';
import axios from 'axios';

interface ApiAuthHandlers {
  onUnauthorized?: () => void;
  onNetworkError?: () => void;
}

let authHandlers: ApiAuthHandlers = {};

export function setApiAuthHandlers(handlers: ApiAuthHandlers): void {
  authHandlers = handlers;
}

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Request interceptor — add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authHandlers.onUnauthorized?.();
      // Fallback: still clear local storage even if handler is not registered yet.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (
        router.currentRoute.value.name !== 'login'
        && router.currentRoute.value.name !== 'setup'
        && router.currentRoute.value.name !== 'setup-status-error'
      ) {
        router.push('/login');
      }
    } else if (!error.response) {
      authHandlers.onNetworkError?.();
      const routeName = String(router.currentRoute.value.name || '');
      const isPublicAuthPage = routeName === 'login' || routeName === 'setup' || routeName === 'setup-status-error';
      if (!isPublicAuthPage) {
        router.push({
          name: 'setup-status-error',
          query: { redirect: router.currentRoute.value.fullPath },
        });
      }
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authApi = {
  setupStatus() {
    return api.get<SetupStatus>('/auth/setup-status');
  },
  setup(username: string, password: string, displayName?: string) {
    return api.post<AuthResponse>('/auth/setup', { username, password, display_name: displayName });
  },
  login(username: string, password: string) {
    return api.post<AuthResponse>('/auth/login', { username, password });
  },
  me() {
    return api.get<User>('/auth/me');
  },
  updateProfile(data: { display_name?: string; password?: string }) {
    return api.put<User>('/auth/profile', data);
  },
  listUsers() {
    return api.get<User[]>('/auth/users');
  },
  createUser(payload: CreateUserPayload) {
    return api.post<User>('/auth/users', payload);
  },
  updateUser(id: string | number, data: { display_name?: string; role?: string; password?: string }) {
    return api.put<User>(`/auth/users/${id}`, data);
  },
  deleteUser(id: string | number) {
    return api.delete(`/auth/users/${id}`);
  },
};

// Task API
export const taskApi = {
  list(filter: TaskFilter = {}) {
    return api.get<{ data: Task[]; total: number }>('/tasks', { params: filter });
  },
  tree() {
    return api.get<Task[]>('/tasks/tree');
  },
  getById(id: string) {
    return api.get<Task>(`/tasks/${id}`);
  },
  create(data: Partial<Task>) {
    return api.post<Task>('/tasks', data);
  },
  update(id: string, data: Partial<Task>) {
    return api.put<Task>(`/tasks/${id}`, data);
  },
  changeStatus(id: string, status: string) {
    return api.patch<Task>(`/tasks/${id}/status`, { status });
  },
  delete(id: string) {
    return api.delete(`/tasks/${id}`);
  },
  batch(action: string, ids: string[], params?: Record<string, unknown>) {
    return api.post('/tasks/batch', { action, ids, params });
  },
  exportUrl(format: string, filter: TaskFilter = {}) {
    const params = new URLSearchParams();
    params.set('format', format);
    if (filter.status) params.set('status', filter.status);
    if (filter.priority) params.set('priority', filter.priority);
    if (filter.iteration_id) params.set('iteration_id', filter.iteration_id);
    if (filter.search) params.set('search', filter.search);
    const token = localStorage.getItem('token');
    if (token) params.set('token', token);
    return `/api/tasks/export?${params.toString()}`;
  },
};

// Iteration API
export const iterationApi = {
  list() {
    return api.get<Iteration[]>('/iterations');
  },
  active() {
    return api.get<Iteration | null>('/iterations/active');
  },
  latest() {
    return api.get<Iteration | null>('/iterations/latest');
  },
  getById(id: string) {
    return api.get<Iteration>(`/iterations/${id}`);
  },
  create(data: Partial<Iteration>) {
    return api.post<Iteration>('/iterations', data);
  },
  update(id: string, data: Partial<Iteration>) {
    return api.put<Iteration>(`/iterations/${id}`, data);
  },
  changeStatus(id: string, status: string) {
    return api.patch<Iteration>(`/iterations/${id}/status`, { status });
  },
  delete(id: string) {
    return api.delete(`/iterations/${id}`);
  },
};

// Stats API
export const statsApi = {
  burndown(iterationId: string) {
    return api.get<BurndownData>(`/stats/burndown/${iterationId}`);
  },
  workload(startDate: string, endDate: string, granularity: string = 'month') {
    return api.get<WorkloadStats>('/stats/workload', {
      params: { start_date: startDate, end_date: endDate, granularity },
    });
  },
};

// Backup API
export const backupApi = {
  getConfig() {
    return api.get<BackupConfig>('/backup/config');
  },
  updateConfig(data: Partial<BackupConfig>) {
    return api.put<BackupConfig>('/backup/config', data);
  },
  trigger() {
    return api.post<{ success: boolean; message: string }>('/backup/trigger');
  },
  status() {
    return api.get<{ enabled: boolean; last_backup_at: string | null; files: Array<{ name: string; lastmod: string }> }>('/backup/status');
  },
  restore(fileName?: string) {
    return api.post<{ success: boolean; message: string }>('/backup/restore', { fileName });
  },
  cleanup() {
    return api.post<{ success: boolean; deleted: number; kept: number; message: string }>('/backup/cleanup');
  },
};

export default api;
