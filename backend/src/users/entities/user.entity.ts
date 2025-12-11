import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Descarga } from '../../descargas/entities/descarga.entity';

@Entity('users')
export class User {  
  @ApiProperty({ description: 'ID único del usuario' })
  @PrimaryGeneratedColumn()
  id_usuario: number;

  @ApiProperty({ description: 'Estado del usuario (0=Inactivo, 1=Activo)' })
  @Column({ type: 'integer', nullable: true })
  status: number;
  @ApiProperty({ description: 'Rol del usuario (1=Admin, 2=Mayorista, 3=Distribuidor, 4=Facturación)' })
  @Column({ type: 'integer', nullable: true, name: 'id_rol' })
  rol: number;
  
  @ApiProperty({ description: 'Nombre completo del usuario' })
  @Column({ type: 'text', nullable: true })
  nombre: string;

  @ApiProperty({ description: 'Email del usuario' })
  @Column({ type: 'text', nullable: true })
  mail: string;

  @ApiPropertyOptional({ description: 'Contraseña hasheada (no se expone en API)' })
  @Column({ type: 'text', nullable: true })
  password: string;

  @Column({ type: 'boolean', default: false })
  must_change_password: boolean;

  @Column({ type: 'integer', nullable: true })
  id_mayorista: number;

  @Column({ type: 'text', nullable: true })
  cuit: string;

  @Column({ type: 'integer', default: 5 })
  limite_descargas: number;

  @Column({ type: 'integer', nullable: true })
  created_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  ultimo_login: Date;

  @Column({ type: 'text', nullable: true })
  celular: string;

  @Column({
    type: 'enum',
    enum: ['CUENTA_CORRIENTE', 'PREPAGO'],
    default: 'CUENTA_CORRIENTE'
  })
  @ApiProperty({
    description: 'Tipo de descarga del usuario',
    enum: ['CUENTA_CORRIENTE', 'PREPAGO'],
    default: 'CUENTA_CORRIENTE',
    example: 'CUENTA_CORRIENTE'
  })
  tipo_descarga: 'CUENTA_CORRIENTE' | 'PREPAGO';
  
  @OneToMany(() => Descarga, descarga => descarga.usuario)
  descargas: Descarga[];
}