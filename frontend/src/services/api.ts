import { LoginDto, LoginResponse, ApiResponse } from '@/types';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    // Cargar token del localStorage si está disponible
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        let customError = data.message || 'Error en la solicitud';
        if (response.status === 403) {
          customError = 'No tienes permisos para acceder a esta sección.';
        }
        return {
          success: false,
          error: customError,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: 'Error de conexión con el servidor',
      };
    }
  }  // Métodos de autenticación
  async login(credentials: LoginDto): Promise<ApiResponse<LoginResponse>> {
    const result = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (result.success && result.data?.access_token) {
      this.setToken(result.data.access_token);
      // Guardar usuario completo en localStorage
      if (result.data.user && typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(result.data.user));
      }
    }

    return result;
  }

  async logout(): Promise<void> {
    this.clearToken();
  }
  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
      // También almacenar en cookie para el middleware
      document.cookie = `auth_token=${token}; path=/; max-age=${24 * 60 * 60}`; // 24 horas
    }
  }
  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      // Limpiar cookie también
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();