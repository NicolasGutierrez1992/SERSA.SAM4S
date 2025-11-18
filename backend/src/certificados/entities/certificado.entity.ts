import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('certificados_v2')
export class Certificado {
  @ApiProperty({ description: 'ID único del certificado', example: 'SESHIA-0000001234' })
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id_certificado: string;

  @ApiProperty({ description: 'Fabricante', example: 'SE' })
  @Column({ type: 'varchar', length: 10, default: 'SE' })
  fabricante: string;

  @ApiProperty({ description: 'Marca', example: 'SH' })
  @Column({ type: 'varchar', length: 10 })
  marca: string;

  @ApiProperty({ description: 'Modelo', example: 'IA' })
  @Column({ type: 'varchar', length: 10 })
  modelo: string;

  @ApiProperty({ description: 'Número de serie', example: '0000001234' })
  @Column({ type: 'varchar', length: 20 })
  numero_serie: string;

  @ApiPropertyOptional({ description: 'Metadata en formato JSONB' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @ApiPropertyOptional({ description: 'Nombre del archivo .pem descargado' })
  @Column({ type: 'text', nullable: true })
  archivo_referencia: string;

  @ApiProperty({ description: 'Fecha de creación' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}