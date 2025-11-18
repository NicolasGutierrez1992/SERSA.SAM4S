import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('mayoristas')
export class Mayorista {
  @PrimaryGeneratedColumn({ name: 'id_mayorista' })
  id_mayorista: number;

  @Column({ type: 'text' })
  nombre: string;
}
