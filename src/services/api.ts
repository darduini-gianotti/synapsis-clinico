import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set initial Authorization header if token exists in localStorage
const initialToken = typeof window !== 'undefined' ? localStorage.getItem('psico_token') : null;
if (initialToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('psico_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isLoginOrAuthMe = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/me');

      if (!isLoginOrAuthMe && typeof window !== 'undefined') {
        localStorage.removeItem('psico_token');
        localStorage.removeItem('psico_user');
        delete api.defaults.headers.common['Authorization'];
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

