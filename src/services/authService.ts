import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

interface LoginResponse {
  token: string;
  username: string;
}

interface RegisterResponse {
  message: string;
  userId: number;
}

class AuthService {
  private tokenKey = 'chat-jwt-token';
  private usernameKey = 'chat-username';

  // Store token in localStorage
  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  // Get token from localStorage
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Store username in localStorage
  setUsername(username: string): void {
    localStorage.setItem(this.usernameKey, username);
  }

  // Get username from localStorage
  getUsername(): string | null {
    return localStorage.getItem(this.usernameKey);
  }

  // Clear all stored data
  clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.usernameKey);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Login user
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/login`, {
        username,
        password
      });
      console.log("response.data", response.data);
      const { token, username: returnedUsername } = response.data;
      this.setToken(token);
      this.setUsername(returnedUsername);

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  // Register user
  async register(username: string, password: string): Promise<RegisterResponse> {
    try {
      const response = await axios.post<RegisterResponse>(`${API_BASE_URL}/register`, {
        username,
        password
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  }

  // Logout user
  logout(): void {
    this.clearAuth();
  }
}

export default new AuthService();