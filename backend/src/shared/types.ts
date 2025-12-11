// Tipos compartidos para evitar conflictos entre entidades y servicios

export enum EstadoDescarga {
  PREPAGO = 'PREPAGO',
  PENDIENTE_FACTURAR = 'Pendiente de Facturar',
  FACTURADO = 'Facturado',
  COBRADO = 'Cobrado'
}

// Interface base para Descarga que funciona tanto en servicios como controladores
export interface IDescarga {
  id: string;
  usuarioId: number;
  controladorId?: string;
  certificadoNombre: string;
  estadoMayorista: EstadoDescarga;
  fechaFacturacion: Date;
  estadoDistribuidor: EstadoDescarga;
  createdAt: Date;
  updatedAt: Date;
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