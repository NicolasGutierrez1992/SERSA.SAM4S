import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IniciarGeneracionResponseDto {
  @ApiProperty({
    description: 'ID del job de generación, usado para consultar su estado',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  jobId: string;

  @ApiProperty({
    description: 'Estado inicial del job',
    example: 'PROCESANDO',
    enum: ['PROCESANDO'],
  })
  status: 'PROCESANDO';
}

export class EstadoGeneracionResponseDto {
  @ApiProperty({
    description: 'Estado actual del job de generación',
    enum: ['PROCESANDO', 'COMPLETADO', 'ERROR'],
  })
  status: 'PROCESANDO' | 'COMPLETADO' | 'ERROR';

  @ApiPropertyOptional({ description: 'ID de la descarga ya generada (solo si status = COMPLETADO)' })
  downloadId?: string;

  @ApiPropertyOptional({ description: 'Nombre del archivo generado (solo si status = COMPLETADO)' })
  filename?: string;

  @ApiPropertyOptional({ description: 'Tamaño del archivo en bytes (solo si status = COMPLETADO)' })
  size?: number;

  @ApiPropertyOptional({ description: 'Checksum del archivo (solo si status = COMPLETADO)' })
  checksum?: string;

  @ApiPropertyOptional({ description: 'Mensaje de error, seguro para mostrar al usuario (solo si status = ERROR)' })
  message?: string;
}
