import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

@Entity('auditoria')
export class Auditoria {
  @ApiProperty({ description: 'ID único del registro de auditoría' })
  @PrimaryGeneratedColumn('uuid')
  id_auditoria: string;

  @ApiProperty({ description: 'ID del usuario que realizó la acción' })
  @Column({ type: 'integer', nullable: true })
  actor_id: number;

  @ApiProperty({ description: 'Acción realizada (CREATE, UPDATE, DELETE, etc.)' })
  @Column({ type: 'text' })
  accion: string;

  @ApiProperty({ description: 'Tipo de entidad afectada (User, Certificado, etc.)' })
  @Column({ type: 'text' })
  objetivo_tipo: string;

  @ApiProperty({ description: 'ID de la entidad afectada', required: false })
  @Column({ type: 'text', nullable: true })
  objetivo_id: string;

  @ApiProperty({ description: 'Valores anteriores (JSON)', required: false })
  @Column({ type: 'jsonb', nullable: true })
  antes: any;

  @ApiProperty({ description: 'Valores nuevos (JSON)', required: false })
  @Column({ type: 'jsonb', nullable: true })
  despues: any;
  @ApiProperty({ description: 'IP desde donde se realizó la acción' })
  @Column({ type: 'text', nullable: true })
  ip: string;

  @ApiProperty({ description: 'Fecha y hora de la acción' })
  @Column({ type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  // Relación con User
  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;
}