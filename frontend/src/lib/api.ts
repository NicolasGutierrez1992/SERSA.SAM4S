import axios, { AxiosResponse } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface LoginRequest {
  cuit: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: number;
    cuit: string;
    nombre: string;
    email: string;
    rol: number;
    must_change_password: boolean;
    last_login: Date;
    id_mayorista: number;
    limite_descargas: number;
    tipo_descarga?: 'CUENTA_CORRIENTE' | 'PREPAGO';
  };
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface CreateDescargaRequest {
  controladorId?: string;
  marca: 'SH';
  modelo: 'IA' | 'RA';
  numeroSerie: string;
}

export interface getUserResponse {
  id_usuario: number;
  status: number;
  id_rol: number;
  nombre: string;
  mail: string;
  id_mayorista: number;
  cuit: string;
  limite_descargas: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  ultimo_login: Date;
}

export interface DownloadResponse {
  downloadId: string;
  filename: string;
  size: number;
  checksum: string;
}

export interface DescargaHistorial {
  id: string;
  usuarioId: number;
  controladorId?: string;
  certificadoNombre?: string;
  estadoMayorista: string;
  fechaFacturacion: Date;
  estadoDistribuidor: string;
  createdAt: string;
  updatedAt: string;
  tamaño?: number;
  tipoDescarga?: 'CUENTA_CORRIENTE' | 'PREPAGO' | null;
  numero_factura?: string | null;
  referencia_pago?: string | null;
  numero_factura_distribuidor?: string | null;
  referencia_pago_distribuidor?: string | null;
  usuario?: {
    nombre: string;
    cuit: string;
    mail: string;
    idrol: number;
    id_mayorista?: number;
  };
}

export interface MetricasPersonales {
  rol: number;
  descargasTotales?: number;
  descargasSemana?: number;
  pendienteFacturarMayorista?: number;
  pendienteFacturarDistribuidor?: number;
  descargasPropiasTotal?: number;
  pendienteFacturar?: number;
  pendienteCobrar?: number;
  limiteDescargas?: number;
  porcentajeLimite?: number;
}

export interface ValidacionDescargaDto {
  canDownload: boolean;
  message: string;
  userType: 'CUENTA_CORRIENTE' | 'PREPAGO' | 'SIN_LIMITE';
  limiteDisponible: number;
}

// ─── Cliente Axios ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_URL,
  // Envía la cookie auth_token automáticamente en cada request
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request — adjuntar token cuando las cookies cross-site están bloqueadas
api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de respuesta — manejo de 401
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearUserInfo();
      // No redirigir con window.location.href (causa hard refresh completo).
      // El middleware de Next.js protege las rutas via auth_token.
      // Cada componente maneja su propio estado de error 401.
    }
    return Promise.reject(error);
  },
);

// ─── Cookie helpers (user_info — no httpOnly, solo datos de display) ─────────

const USER_COOKIE = 'user_info';
const TOKEN_COOKIE = 'session_token';

// Detect HTTPS at runtime — process.env.NODE_ENV is always 'production' in Next.js builds
// so it can't be used to distinguish HTTP localhost from HTTPS production.
// A Secure cookie is silently dropped by the browser on HTTP, breaking the auth flow.
const isSecureContext = (): boolean =>
  typeof window !== 'undefined' && window.location.protocol === 'https:';

export const setUser = (user: LoginResponse['user']): void => {
  Cookies.set(USER_COOKIE, JSON.stringify(user), {
    sameSite: 'lax',
    secure: isSecureContext(),
    expires: 1 / 24,
  });
};

export const setSessionToken = (token: string): void => {
  Cookies.set(TOKEN_COOKIE, token, {
    sameSite: 'lax',
    secure: isSecureContext(),
    expires: 1 / 24,
  });
};

export const getSessionToken = (): string | undefined =>
  Cookies.get(TOKEN_COOKIE);

export const getUser = (): LoginResponse['user'] | null => {
  try {
    const raw = Cookies.get(USER_COOKIE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearUserInfo = (): void => {
  Cookies.remove(USER_COOKIE);
  Cookies.remove(TOKEN_COOKIE);
};

export const isAuthenticated = (): boolean => {
  return !!getUser();
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse & { access_token?: string }>('/auth/login', credentials);
    if (response.data.user) {
      setUser(response.data.user);
    }
    // Guardar token para enviarlo como Authorization: Bearer en requests cross-domain
    if (response.data.access_token) {
      setSessionToken(response.data.access_token);
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearUserInfo();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await api.post('/auth/change-password', data);
  },

  me: async (): Promise<LoginResponse['user']> => {
    const response = await api.get<LoginResponse['user']>('/auth/me');
    return response.data;
  },
};

// ─── Funciones de usuario ─────────────────────────────────────────────────────

export const getUserById = async (id: number): Promise<getUserResponse> => {
  const response = await api.get<getUserResponse>(`/users/${id}`);
  return response.data;
};

// ─── Certificados API ─────────────────────────────────────────────────────────

export const certificadosApi = {
  descargarCertificado: async (data: CreateDescargaRequest): Promise<DownloadResponse> => {
    const response = await api.post<DownloadResponse>('/certificados/descargar', data);
    return response.data;
  },

  descargarArchivo: async (downloadId: string): Promise<Blob> => {
    const response = await api.get(`/certificados/descargar/${downloadId}/archivo`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getHistorialDescargas: async (params?: {
    page?: number;
    limit?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    controladorId?: string;
    estadoMayorista?: string;
    estadoDistribuidor?: string;
    marca?: string;
    cuit?: string;
    idMayorista?: string;
    mes?: number;
    anio?: number;
    userRole?: number;
  }): Promise<{ descargas: DescargaHistorial[]; total: number; totalPages?: number }> => {
    const filteredParams: Record<string, unknown> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          filteredParams[key] = value;
        }
      });
    }

    const response = await api.get('/certificados/descargas', { params: filteredParams });
    const { descargas, total, totalPages } = response.data;
    const limit = (filteredParams.limit as number) || 50;
    return { descargas, total, totalPages: totalPages ?? Math.ceil(total / limit) };
  },

  cambiarEstado: async (
    downloadId: string,
    estado: {
      estadoMayorista?: string;
      estadoDistribuidor?: string;
      numero_factura?: string;
      referencia_pago?: string;
      numero_factura_distribuidor?: string;
      referencia_pago_distribuidor?: string;
    },
  ): Promise<DescargaHistorial> => {
    const response = await api.put(`/certificados/descargas/${downloadId}/estado`, estado);
    return response.data;
  },

  getMetricas: async (): Promise<MetricasPersonales> => {
    const response = await api.get<MetricasPersonales>('/certificados/metricas');
    return response.data;
  },

  validarDescarga: async (): Promise<ValidacionDescargaDto> => {
    const response = await api.get<ValidacionDescargaDto>('/certificados/validar-descarga');
    return response.data;
  },

  getAfipStatus: async (): Promise<{
    wsaa: string;
    wscert: string;
    config_valid: boolean;
    errors: string[];
    last_check: string;
  }> => {
    const response = await api.get('/certificados/afip/status');
    return response.data;
  },

  getDescargasPorUsuario: async (usuarioId: number) => {
    const response = await api.get(`/certificados/descargas/usuario/${usuarioId}`);
    return response.data;
  },

  getDescargasPorMayorista: async (mayoristaId: number) => {
    const response = await api.get(`/certificados/descargas/mayorista/${mayoristaId}`);
    return response.data;
  },

  uploadPfx: async (
    pfxFile: File,
    password: string,
    identificador?: string,
  ): Promise<{ message: string; certificado_identificador?: string }> => {
    const formData = new FormData();
    formData.append('pfxFile', pfxFile);
    formData.append('password', password);
    if (identificador) formData.append('certificado_identificador', identificador);
    const response = await api.post('/certificados-maestro/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadRootRti: async (file: File): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();
    formData.append('rootRtiFile', file);
    const response = await api.post('/certificados-maestro/upload-root-rti', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// ─── App Settings API ─────────────────────────────────────────────────────────

export const appSettingsApi = {
  getAll: async (): Promise<
    Array<{ id: string; value: string; description?: string; data_type?: string }>
  > => {
    const response = await api.get('/app-settings');
    return response.data;
  },

  getByKey: async (key: string): Promise<{ id: string; value: string }> => {
    const response = await api.get(`/app-settings/${key}`);
    return response.data;
  },

  update: async (key: string, value: string): Promise<{ message: string }> => {
    const response = await api.put(`/app-settings/${key}`, { value });
    return response.data;
  },

  getCacheStats: async (): Promise<unknown> => {
    const response = await api.get('/app-settings/debug/cache-stats');
    return response.data;
  },

  refreshCache: async (): Promise<{ message: string }> => {
    const response = await api.put('/app-settings/debug/refresh-cache', {});
    return response.data;
  },
};

export default api;
