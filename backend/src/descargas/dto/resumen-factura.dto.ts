import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 'FACTURADO' y 'SALDO_MIGRADO' son sentinels fijos; cualquier otro valor es
// el texto literal de estadoMayorista/estadoDistribuidor de la descarga
// (Pendiente de Facturar, Garantia, Bonificado, Cobrado, etc.) — cada estado
// real queda en su propio grupo en vez de mezclarse bajo un bucket genérico.
export type BucketFactura = 'FACTURADO' | 'SALDO_MIGRADO' | string;

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
      'FACTURADO: agrupado por numeroFactura. SALDO_MIGRADO: prepago sin compra prepago asociada. Cualquier otro valor: texto real de estadoMayorista/estadoDistribuidor sin número de factura (Pendiente de Facturar, Garantia, Bonificado, etc.).',
    example: 'FACTURADO',
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

  @ApiPropertyOptional({
    description:
      'Solo facturas PREPAGO (bucket FACTURADO originado en una compra prepago): cantidad total comprada en esa compra. Null en cuenta corriente y en cualquier otro bucket.',
  })
  cantidadComprada: number | null;

  @ApiPropertyOptional({
    description:
      'Solo facturas PREPAGO: cantidad total ya consumida de esa compra (global, no solo lo visible en el filtro activo). Null en cuenta corriente y en cualquier otro bucket.',
  })
  cantidadUtilizada: number | null;

  @ApiProperty({ description: 'Fecha de la descarga más antigua del grupo' })
  primeraDescarga: Date;

  @ApiProperty({ description: 'Fecha de la descarga más reciente del grupo' })
  ultimaDescarga: Date;
}

export class ResumenFacturasResponseDto {
  @ApiProperty({ type: [ResumenFacturaDto] })
  facturas: ResumenFacturaDto[];

  @ApiProperty({ description: 'Cantidad total de facturas (sin paginar)' })
  total: number;
}
