import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { Notificacion } from './entities/notificacion.entity';
import { UsersModule } from '../users/users.module';
import { SharedAuthModule } from '../auth/shared-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notificacion]),
    UsersModule,
    SharedAuthModule,
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService, TypeOrmModule],
})
export class NotificacionesModule {}