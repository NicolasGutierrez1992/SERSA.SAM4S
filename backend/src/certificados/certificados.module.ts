import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { User } from '../users/entities/user.entity';
import { Certificado } from './entities/certificado.entity';
import { AfipModule } from '../afip/afip.module';
import { DescargasModule } from '../descargas/descargas.module';
import { UsersModule } from '../users/users.module';

import { SharedAuthModule } from '../auth/shared-auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Certificado]), // Solo entidades del módulo certificados
    forwardRef(() => AfipModule),
    forwardRef(() => DescargasModule), // Importamos el módulo completo para usar DescargasService
    SharedAuthModule,
    UsersModule,
  ],
  controllers: [CertificadosController],
  providers: [CertificadosService],
  exports: [CertificadosService],
})
export class CertificadosModule {}