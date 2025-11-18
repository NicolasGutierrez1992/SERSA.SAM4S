import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id_notificacion: string;

  @Column({ type: 'text' })
  tipo: string;

  @Column({ type: 'integer', nullable: true })
  destinatario_id: number;

  @Column({ type: 'text', default: 'Pendiente' })
  estado_envio: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;

  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  // Relación con User
  @ManyToOne(() => User)
  @JoinColumn({ name: 'destinatario_id' })
  destinatario: User;
}