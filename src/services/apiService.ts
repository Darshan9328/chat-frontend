import axios from 'axios';
import authService from './authService';

const API_BASE_URL = 'http://192.168.1.78:8080/api';

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

export const apiService = {
  // Authentication
  login: async (username: string, password: string) => {
    const response = await axios.post(`${API_BASE_URL}/login`, {
      username,
      password
    });
    return response.data;
  },

  register: async (username: string, password: string) => {
    const response = await axios.post(`${API_BASE_URL}/register`, {
      username,
      password
    });
    return response.data;
  },

  // Messages (legacy - for backward compatibility)
  getMessages: async () => {
    const response = await apiClient.get('/messages');
    return response.data;
  },

  // Conversations
  getUserConversations: async (username: string) => {
  const response = await apiClient.get(`/conversations/${username}`);
  console.log("[apiService] getUserConversations called for:", username);
  console.log("[apiService] getUserConversations response:", response.data);
  return response.data;
  },

  getConversationMessages: async (conversationId: string) => {
    const response = await apiClient.get(`/conversations/${conversationId}/messages`);
    return response.data;
  },

  startConversation: async (user1: string, user2: string) => {
    const response = await apiClient.post('/conversations/start', {
      user1,
      user2
    });
    return response.data;
  },

  searchUsers: async (currentUser: string, query?: string) => {
    const url = `/conversations/search/${currentUser}${query ? `?query=${encodeURIComponent(query)}` : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  markMessagesAsRead: async (conversationId: string, username: string) => {
    const response = await apiClient.post(`/conversations/${conversationId}/mark-read`, null, {
      params: { username }
    });
    return response.data;
  }
};

export default apiClient;
