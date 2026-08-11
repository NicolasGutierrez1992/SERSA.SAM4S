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
  csrfToken?: string;
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

export interface CompraPrepago {
  id: number;
  id_usuario: number;
  numero_factura: string | null;
  cantidad: number;
  cantidad_usada: number;
  disponible: number;
  fecha_compra: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
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
  numeroFacturaCompraPrepago?: string | null;
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
  descargasPrepago?: number;
  descargasCuentaCorriente?: number;
  saldoPrepago?: number;
  saldoCuentaCorriente?: number;
  limiteCuentaCorriente?: number;
}

export interface RankingSaldoPrepagoBajo {
  id_usuario: number;
  nombre: string;
  saldoPrepago: number;
}

export interface ValidacionDescargaDto {
  canDownload: boolean;
  message: string;
  userType: 'CUENTA_CORRIENTE' | 'PREPAGO' | 'SIN_LIMITE';
  limiteDisponible: number;
  saldoPrepago?: number;
  saldoCuentaCorriente?: number;
  limiteCuentaCorriente?: number;
  yaDescargado?: boolean;
  fechaUltimaDescarga?: string;
}

// ─── Cliente Axios ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_URL,
  // Envía la cookie auth_token automáticamente en cada request
  withCredentials: true,
  // Evita que un request quede colgado indefinidamente (ej: pestaña reactivada tras
  // estar inactiva/throttleada por el navegador) — falla rápido en vez de tildar la UI.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Interceptor de request — adjuntar token cuando las cookies cross-site están bloqueadas,
// y el header anti-CSRF en requests mutantes (ver CsrfGuard en el backend).
api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const method = config.method?.toLowerCase();
  if (method && MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Interceptor de respuesta — manejo de 401
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      clearUserInfo();
      // Redirigir a /login para resetear todo el estado de React (evita que la UI
      // quede "tildada" con loading flags pegados tras vencer la sesión). No aplica
      // al propio request de login fallido, para no pisar el mensaje de error ahí.
      if (!isLoginRequest && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Cookie helpers (user_info — no httpOnly, solo datos de display) ─────────

const USER_COOKIE = 'user_info';
const TOKEN_COOKIE = 'session_token';
const CSRF_COOKIE = 'csrf_token';

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

export const setCsrfToken = (token: string): void => {
  Cookies.set(CSRF_COOKIE, token, {
    sameSite: 'lax',
    secure: isSecureContext(),
    expires: 1 / 24,
  });
};

export const getCsrfToken = (): string | undefined =>
  Cookies.get(CSRF_COOKIE);

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
  Cookies.remove(CSRF_COOKIE);
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
    // Guardar nonce anti-CSRF para reenviarlo como header en requests mutantes
    if (response.data.csrfToken) {
      setCsrfToken(response.data.csrfToken);
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

  getRankingSaldoPrepagoBajo: async (): Promise<RankingSaldoPrepagoBajo[]> => {
    const response = await api.get<RankingSaldoPrepagoBajo[]>('/users/ranking-saldo-prepago');
    return response.data;
  },

  validarDescarga: async (params?: { marca?: string; modelo?: string; numeroSerie?: string }): Promise<ValidacionDescargaDto> => {
    const response = await api.get<ValidacionDescargaDto>('/certificados/validar-descarga', { params });
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

// ─── Auditoría API (solo Administradores) ─────────────────────────────────────

export interface AuditoriaLog {
  id_auditoria: string;
  actor_id: number | null;
  accion: string;
  objetivo_tipo: string;
  objetivo_id: string | null;
  /** Número de controlador (id_certificado) cuando el objetivo es una descarga/certificado */
  objetivo_referencia: string | null;
  antes: unknown;
  despues: unknown;
  ip: string | null;
  timestamp: string;
  actor?: {
    id_usuario: number;
    nombre: string;
    cuit: string;
    rol: number;
  };
}

export interface AuditoriaStatistics {
  totalAcciones: number;
  accionesPorTipo: Array<{ accion: string; total: number }>;
  entidadesPorTipo: Array<{ objetivo_tipo: string; total: number }>;
  usuariosActivos: Array<{ actor_id: number; nombre: string; total: number }>;
  actividadPorDia: Array<{ fecha: string; total: number }>;
}

export interface AuditoriaQueryParams {
  actor_id?: number;
  accion?: string;
  objetivo_tipo?: string;
  objetivo_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}

export const auditoriaApi = {
  getAll: async (
    params?: AuditoriaQueryParams,
  ): Promise<{ data: AuditoriaLog[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/auditoria', { params });
    return response.data;
  },

  getStatistics: async (fechaDesde?: string, fechaHasta?: string): Promise<AuditoriaStatistics> => {
    const response = await api.get<AuditoriaStatistics>('/auditoria/statistics', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    });
    return response.data;
  },

  exportCsv: async (params?: AuditoriaQueryParams): Promise<Blob> => {
    const response = await api.get('/auditoria/export/csv', {
      params,
      responseType: 'blob',
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
