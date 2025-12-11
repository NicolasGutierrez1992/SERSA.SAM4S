import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

@Entity('descargas')
export class Descarga {
  @ApiProperty({ 
    description: 'ID único de la descarga',
    example: 'uuid-123-456-789'
  })
  @PrimaryGeneratedColumn('uuid')
  id_descarga: string;

  @ApiProperty({ 
    description: 'ID del usuario que realizó la descarga'
  })
  @Column({ type: 'integer' })
  id_usuario: number;

  @ManyToOne(() => User, user => user.descargas)
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;
  @ApiPropertyOptional({ 
    description: 'ID del certificado de referencia (ej: SESHIA-0000001234)'
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  id_certificado: string;

  @ApiProperty({ 
    description: 'Estado de facturación mayorista',
    enum: ['Pendiente de Facturar', 'Facturado', 'Cobrado'],
    default: 'Pendiente de Facturar'
  })
  @Column({ type: 'text', default: 'Pendiente de Facturar' })
  estadoMayorista: string;

  @ApiProperty({ 
    description: 'Fecha de facturacion'
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_facturacion: Date;

  @ApiProperty({ 
    description: 'Estado de facturación distribuidor',
    enum: ['Pendiente de Facturar', 'Facturado', 'Cobrado'],
    default: 'Pendiente de Facturar'
  })
  @Column({ type: 'text', default: 'Pendiente de Facturar' })
  estadoDistribuidor: string;

  @ApiPropertyOptional({ 
    description: 'Tamaño del archivo en bytes'
  })
  @Column({ type: 'bigint', nullable: true })
  tamaño: number;

  @ApiProperty({ 
    description: 'Fecha de creación del registro'
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ApiProperty({ 
    description: 'Fecha de última actualización'
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ApiPropertyOptional({ 
    description: 'Nombre descriptivo del certificado generado'
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  certificado_nombre: string;


}