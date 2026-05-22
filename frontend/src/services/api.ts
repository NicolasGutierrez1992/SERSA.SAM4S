/**
 * Thin adapter que delega en lib/api.ts (cliente axios + cookies httpOnly).
 * Mantiene la interfaz que usa AuthContext para no romper el contrato existente.
 */
import { LoginDto, LoginResponse, ApiResponse } from '@/types';
import { authApi, getUser, isAuthenticated as checkAuth } from '@/lib/api';

class ApiService {
  async login(credentials: LoginDto): Promise<ApiResponse<LoginResponse>> {
    try {
      const data = await authApi.login(credentials as any);
      return { success: true, data: data as any };
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Error de conexión con el servidor';
      return { success: false, error: message };
    }
  }

  async logout(): Promise<void> {
    await authApi.logout();
  }

  getToken(): string | null {
    // El token ahora viaja en cookie httpOnly — no es accesible desde JS.
    // Retornamos un valor truthy si el usuario tiene sesión activa.
    return isAuthenticated() ? 'cookie-session' : null;
  }

  isAuthenticated(): boolean {
    return checkAuth();
  }
}

export function isAuthenticated(): boolean {
  return !!getUser();
}

export const apiService = new ApiService();
