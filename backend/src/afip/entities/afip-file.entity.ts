import { Entity, PrimaryColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('afip_files')
@Index(['file_type', 'activo'])
@Index(['created_at'])
export class AfipFile {
  @ApiProperty({ 
    description: 'ID único del archivo AFIP',
    example: 'ROOT_RTI'
  })
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @ApiProperty({ 
    description: 'Tipo de archivo AFIP',
    example: 'ROOT_RTI',
    enum: ['ROOT_RTI', 'CERT_BACKUP']
  })
  @Column({ type: 'varchar', length: 20 })
  file_type: string;

  @ApiProperty({ 
    description: 'Datos del archivo en formato binario',
  })
  @Column({ type: 'bytea' })
  file_data: Buffer;

  @ApiProperty({ 
    description: 'Nombre original del archivo',
    example: 'Root_RTI.txt'
  })
  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @ApiPropertyOptional({ 
    description: 'Tamaño del archivo en bytes',
    example: 2048
  })
  @Column({ type: 'int', nullable: true })
  file_size?: number;

  @ApiProperty({ 
    description: 'Indica si el archivo está activo',
    example: true
  })
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @ApiProperty({ 
    description: 'Fecha de creación',
  })
  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @ApiProperty({ 
    description: 'Fecha de última actualización',
  })
  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ApiPropertyOptional({ 
    description: 'Fecha de carga del archivo',
  })
  @Column({ type: 'timestamp', nullable: true })
  uploaded_at?: Date;
}
