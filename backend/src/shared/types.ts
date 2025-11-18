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
  controladorId?: string;
  certificadoNombre: string;
  estadoMayorista: EstadoDescarga;
  fechaFacturacion: Date;
  estadoDistribuidor: EstadoDescarga;
  createdAt: Date;
  updatedAt: Date;
  tamaño?: number;
  usuario?: {
    nombre: string;
    cuit: string;
    mail: string;
    idrol: number;
  };
}