import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum EstadoBackup {
  EXITOSO = 'EXITOSO',
  FALLIDO = 'FALLIDO',
}

@Entity('backup_logs')
export class BackupLog {
  @ApiProperty({ description: 'ID único del registro de backup' })
  @PrimaryGeneratedColumn('uuid')
  id_backup: string;

  @ApiProperty({ enum: EstadoBackup })
  @Column({ type: 'varchar', length: 20 })
  estado: EstadoBackup;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  nombre_archivo: string;

  @ApiProperty({ required: false })
  @Column({ type: 'bigint', nullable: true })
  tamano_bytes: number;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  drive_file_id: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  error_mensaje: string;

  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  duracion_ms: number;

  @ApiProperty()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;
}
