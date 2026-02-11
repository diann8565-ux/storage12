
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('auth_token');
      // Optionally redirect to login
      // window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    signIn: (data: { email: string; password: string }) => apiClient.post('/auth/login', { username: data.email, password: data.password }),
    me: () => apiClient.get('/auth/me'),
    updatePassword: (data: Record<string, unknown>) => apiClient.put('/auth/password', data),
    signOut: () => {
      localStorage.removeItem('auth_token');
      return Promise.resolve();
    }
    ,
    devLogin: (email?: string) => apiClient.post('/auth/dev-login', email ? { email } : {})
  },
  profiles: {
    get: () => apiClient.get('/profiles'),
    update: (data: Record<string, unknown>) => apiClient.patch('/profiles', data),
  },
  storageCredentials: {
    list: () => apiClient.get('/storage_credentials'),
    create: (data: Record<string, unknown>) => apiClient.post('/storage_credentials', data),
    update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/storage_credentials/${id}`, data),
    delete: (id: string) => apiClient.delete(`/storage_credentials/${id}`),
  },
  files: {
    list: (params?: Record<string, string | number | boolean | undefined>) => apiClient.get('/files', { params }),
    create: (data: Record<string, unknown>) => apiClient.post('/files', data),
    delete: (id: string) => apiClient.delete(`/files/${id}`),
    getCategories: (id: string) => apiClient.get(`/files/${id}/categories`),
    setCategories: (id: string, category_ids: string[]) => apiClient.post(`/files/${id}/categories`, { category_ids }),
  },
  categories: {
    list: () => apiClient.get('/categories'),
    create: (data: Record<string, unknown>) => apiClient.post('/categories', data),
    update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/categories/${id}`, data),
    delete: (id: string) => apiClient.delete(`/categories/${id}`),
  },
  activityLogs: {
    list: () => apiClient.get('/activity_logs'),
    create: (data: Record<string, unknown>) => apiClient.post('/activity_logs', data),
  },
  apiKeys: {
    list: () => apiClient.get('/api_keys'),
    create: (data: { name: string }) => apiClient.post('/api_keys', data),
    delete: (id: string) => apiClient.delete(`/api_keys/${id}`),
  },
  functions: {
    invoke: (name: string, options: { body?: unknown }) => {
      if (name === 'imagekit-upload') {
        return apiClient.post('/functions/imagekit-upload', options.body);
      }
      if (name === 'imagekit-delete') {
        return apiClient.post('/functions/imagekit-delete', options.body);
      }
      if (name === 'cloudinary-sign') {
        return apiClient.post('/functions/cloudinary-sign', options.body);
      }
      if (name === 'cloudinary-delete') {
        return apiClient.post('/functions/cloudinary-delete', options.body);
      }
      return Promise.reject(new Error(`Function ${name} not implemented`));
    }
  }
};
