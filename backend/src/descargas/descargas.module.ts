import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DescargasService } from './descargas.service';
import { Descarga } from './entities/descarga.entity';
import { User } from '../users/entities/user.entity';
import { CompraPrepago } from '../users/entities/compra-prepago.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Certificado } from '../certificados/entities/certificado.entity';
import { TimezoneService } from '../common/timezone.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Descarga, User, Certificado, CompraPrepago]),
    AuditoriaModule,
    CommonModule,
  ],
  controllers: [],
  providers: [DescargasService, TimezoneService],
  exports: [DescargasService, TimezoneService], // Exportar para que otros módulos puedan usarlo
})
export class DescargasModule {}