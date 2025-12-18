import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('app_settings')
export class AppSetting {
  @ApiProperty({ 
    description: 'ID único de la configuración',
    example: 'NOTIFICATION_LIMIT'
  })
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id: string;

  @ApiProperty({ 
    description: 'Valor de la configuración',
    example: '100'
  })
  @Column({ type: 'text' })
  value: string;

  @ApiPropertyOptional({ 
    description: 'Descripción de la configuración',
    example: 'Límite de descargas pendientes para notificación'
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Tipo de dato de la configuración',
    example: 'number',
    enum: ['string', 'number', 'boolean']
  })
  @Column({ type: 'varchar', length: 20, nullable: true, default: 'string' })
  data_type?: 'string' | 'number' | 'boolean';

  @ApiProperty({ 
    description: 'Fecha de última actualización',
  })
  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
