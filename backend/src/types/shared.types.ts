// Tipos compartidos para evitar conflictos entre entidades y servicios

export enum EstadoDescarga {
  PENDIENTE_FACTURAR = 'Pendiente de Facturar',
  FACTURADO = 'Facturado',
  COBRADO = 'Cobrado'
}

// Interface base para Descarga que funciona tanto en servicios como controladores
export interface IDescarga {
  id: string;
  usuarioId: number;
  controladorId: string;
  certificadoNombre: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  certificadoPem: string;
  estadoMayorista: EstadoDescarga;
  estadoDistribuidor: EstadoDescarga;
  fecha: Date;
  createdAt: Date;
  updatedAt: Date;
  // Campos opcionales
  usuario?: any;
  certificadoId?: string;
  certificado?: any;
  logs?: any[];
  checksum?: string;
  tamaño?: number;
  ipOrigen?: string;
}