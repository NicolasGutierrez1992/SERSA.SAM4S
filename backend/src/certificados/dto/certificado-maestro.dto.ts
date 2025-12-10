import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Multer } from 'multer';

export class UploadCertificadoMaestroDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo certificado .pfx',
  })
  pfxFile: Multer.File;

  @ApiProperty({
    description: 'Contraseña del certificado PFX',
    example: 'mipassword123',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'Identificador del certificado (generalmente CUIT)',
    example: '20123456789',
  })
  certificado_identificador?: string;
}

export class CertificadoMaestroResponseDto {
  @ApiProperty({
    description: 'Mensaje de respuesta',
    example: 'Certificado maestro cargado exitosamente',
  })
  mensaje: string;

  @ApiProperty({
    description: 'ID del certificado maestro',
    example: 'AFIP_PRINCIPAL',
  })
  certificado_id: string;
}

export class CertificadoMaestroInfoDto {
  @ApiProperty({
    description: 'Indica si existe un certificado maestro configurado',
  })
  existe: boolean;

  @ApiPropertyOptional({
    description: 'ID del certificado maestro',
  })
  id?: string;

  @ApiPropertyOptional({
    description: 'Identificador del certificado (CUIT)',
  })
  certificado_identificador?: string;

  @ApiPropertyOptional({
    description: 'Metadatos del certificado',
  })
  metadata?: {
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    thumbprint?: string;
  };

  @ApiPropertyOptional({
    description: 'Indica si el certificado está activo',
  })
  activo?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha de carga del certificado',
  })
  uploaded_at?: Date;

  @ApiPropertyOptional({
    description: 'Fecha de última actualización',
  })
  updated_at?: Date;
}
