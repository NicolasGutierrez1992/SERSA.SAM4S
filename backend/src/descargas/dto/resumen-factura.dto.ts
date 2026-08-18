import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type BucketFactura =
  | 'FACTURADO'
  | 'PENDIENTE_FACTURAR'
  | 'SALDO_MIGRADO';

export type ModoResumenFacturas = 'MAYORISTA' | 'DISTRIBUIDOR';

export class ResumenFacturaDto {
  @ApiPropertyOptional({
    description:
      'Número de factura efectiva (Mayorista o Distribuidor según el modo). Null cuando bucket !== FACTURADO.',
    example: '2025-001',
  })
  numeroFactura: string | null;

  @ApiProperty({
    description:
      'FACTURADO: agrupado por numeroFactura. PENDIENTE_FACTURAR: cuenta corriente aún sin número de factura. SALDO_MIGRADO: prepago sin compra prepago asociada.',
    enum: ['FACTURADO', 'PENDIENTE_FACTURAR', 'SALDO_MIGRADO'],
  })
  bucket: BucketFactura;

  @ApiPropertyOptional({ description: 'ID del Mayorista dueño del grupo' })
  idMayorista: number | null;

  @ApiPropertyOptional({ description: 'Nombre del Mayorista dueño del grupo' })
  nombreMayorista: string | null;

  @ApiPropertyOptional({
    description:
      'Modo DISTRIBUIDOR: ID del usuario Distribuidor dueño del grupo. Null en modo MAYORISTA.',
  })
  idUsuario: number | null;

  @ApiPropertyOptional({
    description:
      'Modo DISTRIBUIDOR: nombre del Distribuidor dueño del grupo. Null en modo MAYORISTA.',
  })
  nombreUsuario: string | null;

  @ApiProperty({ description: 'Cantidad de descargas agrupadas' })
  cantidadDescargas: number;

  @ApiProperty({ description: 'Fecha de la descarga más antigua del grupo' })
  primeraDescarga: Date;

  @ApiProperty({ description: 'Fecha de la descarga más reciente del grupo' })
  ultimaDescarga: Date;
}

export class ResumenFacturasResponseDto {
  @ApiProperty({ type: [ResumenFacturaDto] })
  facturas: ResumenFacturaDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}
