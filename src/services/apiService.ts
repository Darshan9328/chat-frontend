import axios from 'axios';
import authService from './authService';

const API_BASE_URL = 'http://170.20.10.3:8080/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      authService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;