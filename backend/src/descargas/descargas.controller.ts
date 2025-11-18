export interface IDescarga {
  id_descarga: number;
  id_usuario: number;
  id_certificado: number;
  estadoMayorista: string;
  estadoDistribuidor: string;
  tamaño: number;
  created_at: Date;
  updated_at: Date;
  certificado_nombre: string;
  fecha_facturacion: Date;
}

export class Descarga implements IDescarga {
  id_descarga: number;
  id_usuario: number;
  id_certificado: number;
  estadoMayorista: string;
  fecha_facturacion: Date;
  estadoDistribuidor: string;
  tamaño: number;
  created_at: Date;
  updated_at: Date;
  certificado_nombre: string;

  constructor(data: IDescarga) {
    this.id_descarga = data.id_descarga;
    this.id_usuario = data.id_usuario;
    this.id_certificado = data.id_certificado;
    this.estadoMayorista = data.estadoMayorista;
    this.fecha_facturacion = data.fecha_facturacion;
    this.estadoDistribuidor = data.estadoDistribuidor;
    this.tamaño = data.tamaño;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.certificado_nombre = data.certificado_nombre;
  }
}