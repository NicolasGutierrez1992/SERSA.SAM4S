import axios, { AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';


// Interfaces
export interface LoginRequest {
  cuit: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
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
  id: string; // id_descarga del backend
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
  // Admin (Rol 1) y Facturador (Rol 4)
  descargasTotales?: number;
  descargasSemana?: number;
  // Mayorista (Rol 2)
  pendienteFacturarMayorista?: number;
  pendienteFacturarDistribuidor?: number;
  descargasPropiasTotal?: number;
  // Distribuidor (Rol 3) - y Admin/Mayorista también pueden tener estos campos
  pendienteFacturar?: number;
  limiteDescargas?: number;
  porcentajeLimite?: number;
}

export interface ValidacionDescargaDto {
  canDownload: boolean;
  message: string;
  userType: 'CUENTA_CORRIENTE' | 'PREPAGO' | 'SIN_LIMITE';
  limiteDisponible: number;
}

// Configurar axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token JWT a las requests
api.interceptors.request.use(
  (config) => {
    const token = getStorageItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    const errorInfo = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      timestamp: new Date().toISOString()
    };

    console.error('[API Interceptor] Error completo:', errorInfo);
    
    if (error.response?.status === 401) {
      console.error('[API Interceptor] ⚠️ ERROR 401 - Token inválido o expirado');
      console.error('[API Interceptor] Respuesta del servidor:', error.response?.data);
      console.error('[API Interceptor] Limpiando sesión y redirigiendo a login...');
      
      removeStorageItem('token');
      removeStorageItem('user');
      if (typeof window !== 'undefined') {
        // Solo redirigir si NO estamos en /login
        if (window.location.pathname !== '/login') {
          console.warn('[API Interceptor] Redirigiendo a /login en 2 segundos...');
          // Agregar delay mayor para permitir que los logs se capturen
          setTimeout(() => {
            console.log('[API Interceptor] Ejecutando redirección a /login');
            window.location.href = '/login';
          }, 2000);
        }
      }
    } else {
      // Log de otros errores para debugging
      console.error('[API Interceptor] Error HTTP (no es 401):', errorInfo);
    }
    return Promise.reject(error);
  }
);

// Funciones auxiliares para localStorage
const getStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
};

const removeStorageItem = (key: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
};


// Servicios de autenticación
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
      const response = await api.post<LoginResponse>('/auth/login', credentials);
      return response.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await api.post('/auth/change-password', data);
  },
  
  logout: () => {
    removeStorageItem('token');
    removeStorageItem('user');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
};

// Utilidades
export const setAuthToken = (token: string) => {
  setStorageItem('token', token);
};

export const setUser = (user: LoginResponse['user']) => {
  setStorageItem('user', JSON.stringify(user));
};

export const getUser = (): LoginResponse['user'] | null => {
  try {
    const userStr = getStorageItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return !!getStorageItem('token');
};
// Obtener usuario por ID de mayorista
export const getUserById = async (id: number): Promise<getUserResponse> => {
  const response = await api.get<getUserResponse>(`/users/${id}`);
  return response.data;
};

// Servicios de certificados
export const certificadosApi = {
  // Generar certificado
  descargarCertificado: async (data: CreateDescargaRequest): Promise<DownloadResponse> => {
    const response = await api.post<DownloadResponse>('/certificados/descargar', data);
    return response.data;
  },

  // Descargar archivo PEM
  descargarArchivo: async (downloadId: string): Promise<Blob> => {
    const response = await api.get(`/certificados/descargar/${downloadId}/archivo`, {
      responseType: 'blob',
    });
    return response.data;  },
  // Obtener historial de descargas
  getHistorialDescargas: async (params?: {
    page?: number;
    limit?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    controladorId?: string;
    estadoMayorista?: string;
    estadoDistribuidor?: string; // ⭐ NUEVO: Filtro por estado distribuidor
    marca?: string;
    cuit?: string;
    idMayorista?: string;
    mes?: number;
    anio?: number;
    userRole?: number; // ⭐ NUEVO: Rol del usuario para filtrado inteligente
  }): Promise<{
    descargas: DescargaHistorial[];
    total: number;
    totalPages?: number;
  }> => {
    // Filtrar parámetros undefined y vacíos para evitar errores de validación
    const filteredParams: any = {};
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        // Solo incluir si no es undefined, null, o string vacío
        if (value !== undefined && value !== null && value !== '') {
          filteredParams[key] = value;
        }
      });
    }
    
    console.log('🔍 getHistorialDescargas - params enviados:', filteredParams);
    
    try {
      const response = await api.get('/certificados/descargas', { params: filteredParams });
      console.log('✅ getHistorialDescargas - respuesta:', response.data);
      
      // Si el backend no envía totalPages, lo calculamos
      const { descargas, total, totalPages } = response.data;
      const limit = filteredParams.limit || 50;
      return {
        descargas,
        total,
        totalPages: totalPages ?? Math.ceil(total / limit)
      };
    } catch (error: any) {
      console.error('❌ getHistorialDescargas error:', error.response?.status, error.response?.data);
      throw error;
    }
  },
  // Cambiar estado de descarga
  cambiarEstado: async (
    downloadId: string,
    estado: { 
      estadoMayorista?: string; 
      estadoDistribuidor?: string;
      numero_factura?: string;
      referencia_pago?: string;
    }
  ): Promise<DescargaHistorial> => {
    const response = await api.put(`/certificados/descargas/${downloadId}/estado`, estado);
    return response.data;
  },

  // Obtener métricas personales
  getMetricas: async (): Promise<MetricasPersonales> => {
    const response = await api.get<MetricasPersonales>('/certificados/metricas');
    return response.data;
  },

  // Validar si usuario puede descargar (PREPAGO)
  validarDescarga: async (): Promise<ValidacionDescargaDto> => {
    const response = await api.get<ValidacionDescargaDto>('/certificados/validar-descarga');
    return response.data;
  },

  // Verificar estado AFIP
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

  // Obtener descargas por usuario
  getDescargasPorUsuario: async (usuarioId: number) => {
    const response = await api.get(`/certificados/descargas/usuario/${usuarioId}`);
    return response.data;
  },

  // Obtener descargas por mayorista
  getDescargasPorMayorista: async (mayoristaId: number) => {
    const response = await api.get(`/certificados/descargas/mayorista/${mayoristaId}`);
    return response.data;
  },

  postUploadCertificado: async (
    files: { certificado?: File | null; pwrCst?: File | null; rootRti?: File | null }
  ): Promise<{ message: string }> => {
    const formData = new FormData();
    if (files.certificado) formData.append('certificado', files.certificado);
    if (files.pwrCst) formData.append('pwrCst', files.pwrCst);
    if (files.rootRti) formData.append('rootRti', files.rootRti);
    const response = await api.post('/certificados/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// App Settings API (Admin only)
export const appSettingsApi = {
  // Obtener todas las configuraciones
  getAll: async (): Promise<Array<{ id: string; value: string; description?: string; data_type?: string }>> => {
    const response = await api.get('/app-settings');
    return response.data;
  },

  // Obtener una configuración específica
  getByKey: async (key: string): Promise<{ id: string; value: string }> => {
    const response = await api.get(`/app-settings/${key}`);
    return response.data;
  },

  // Actualizar una configuración
  update: async (key: string, value: string): Promise<{ message: string }> => {
    const response = await api.put(`/app-settings/${key}`, { value });
    return response.data;
  },

  // Obtener estadísticas del caché (debug)
  getCacheStats: async (): Promise<any> => {
    const response = await api.get('/app-settings/debug/cache-stats');
    return response.data;
  },

  // Forzar actualización del caché
  refreshCache: async (): Promise<{ message: string }> => {
    const response = await api.put('/app-settings/debug/refresh-cache', {});
    return response.data;
  },
};

export default api;