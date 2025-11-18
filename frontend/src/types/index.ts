// Tipos de usuario según el backend
export enum UserRole {
  ADMIN = 1,
  MAYORISTA = 2,
  DISTRIBUIDOR = 3,
  FACTURACION = 4
}

// Estados de descarga
export enum EstadoDescarga {
  PENDIENTE_FACTURAR = 'Pendiente de Facturar',
  FACTURADO = 'Facturado',
  COBRADO = 'Cobrado'
}

// Interfaces de usuario
export interface User {
  id: number;
  cuit: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: UserRole;
  estado: boolean;
  mayorista?: User;
  limiteDescargas: number;
  primerAcceso: boolean;
  ultimoAcceso?: string;
  createdAt: string;
  updatedAt: string;
}

// Respuesta de login
export interface LoginResponse {
  access_token: string;
  user: User;
  expires_in: number;
}

// DTO de login
export interface LoginDto {
  cuit: string;
  password: string;
}

// Respuesta de API genérica
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}