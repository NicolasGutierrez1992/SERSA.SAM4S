import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('certificados_maestro')
export class CertificadoMaestro {
  @ApiProperty({ 
    description: 'ID único del certificado maestro',
    example: 'AFIP_PRINCIPAL'
  })
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @ApiProperty({ 
    description: 'Archivo PFX encriptado (almacenado en base64 encriptado)',
  })
  @Column({ type: 'bytea' })
  pfx_data: Buffer;

  @ApiProperty({ 
    description: 'Contraseña encriptada del certificado PFX'
  })
  @Column({ type: 'text' })
  password_encriptada: string;

  @ApiPropertyOptional({ 
    description: 'Información del certificado en formato JSONB',
    example: {
      subject: 'CN=SERSA',
      issuer: 'CN=AFIP',
      validFrom: '2024-01-01',
      validTo: '2025-01-01'
    }
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    thumbprint?: string;
    [key: string]: any;
  };

  @ApiProperty({ 
    description: 'Identificador del certificado (generalmente el CUIT)',
    nullable: true
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  certificado_identificador?: string;

  @ApiProperty({ 
    description: 'Indica si el certificado está activo'
  })
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @ApiProperty({ 
    description: 'Fecha de creación'
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ApiProperty({ 
    description: 'Fecha de última actualización'
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ApiPropertyOptional({ 
    description: 'Fecha de carga del certificado'
  })
  @Column({ type: 'timestamp', nullable: true })
  uploaded_at?: Date;
}
