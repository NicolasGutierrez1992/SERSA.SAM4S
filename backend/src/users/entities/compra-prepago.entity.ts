import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from './user.entity';

@Entity('compras_prepago')
export class CompraPrepago {
  @ApiProperty({ description: 'ID único de la compra prepago' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID del usuario dueño de la compra' })
  @Column({ type: 'integer' })
  id_usuario: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;

  @ApiPropertyOptional({
    description: 'Número de factura de la compra (null = saldo migrado sin factura)',
    example: '2025-001'
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  numero_factura: string | null;

  @ApiProperty({ description: 'Cantidad de descargas compradas en este lote' })
  @Column({ type: 'integer' })
  cantidad: number;

  @ApiProperty({ description: 'Cantidad de descargas ya consumidas de este lote' })
  @Column({ type: 'integer', default: 0 })
  cantidad_usada: number;

  @ApiProperty({ description: 'Fecha de la compra' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_compra: Date;

  @ApiPropertyOptional({ description: 'ID del usuario que cargó la compra' })
  @Column({ type: 'integer', nullable: true })
  created_by: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
