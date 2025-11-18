import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DescargasService } from './descargas.service';
import { Descarga } from './entities/descarga.entity';
import { User } from '../users/entities/user.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Certificado } from '../certificados/entities/certificado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Descarga, User, Certificado]),
    AuditoriaModule,
  ],
  controllers: [],
  providers: [DescargasService],
  exports: [DescargasService], // Exportar para que CertificadosModule pueda usarlo
})
export class DescargasModule {}