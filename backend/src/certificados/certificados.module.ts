import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { CertificadoMaestroController } from './certificado-maestro.controller';
import { CertificadoMaestroService } from './certificado-maestro.service';
import { User } from '../users/entities/user.entity';
import { Certificado } from './entities/certificado.entity';
import { CertificadoMaestro } from './entities/certificado-maestro.entity';
import { AfipModule } from '../afip/afip.module';
import { DescargasModule } from '../descargas/descargas.module';
import { UsersModule } from '../users/users.module';
import { SharedAuthModule } from '../auth/shared-auth.module';
import { EncryptionService } from '../common/encryption.service';
import { CertificadoMigrationService } from '../common/certificado-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Certificado, CertificadoMaestro]),
    forwardRef(() => AfipModule),
    forwardRef(() => DescargasModule),
    SharedAuthModule,
    UsersModule,
  ],
  controllers: [CertificadosController, CertificadoMaestroController],
  providers: [CertificadosService, CertificadoMaestroService, EncryptionService, CertificadoMigrationService],
  exports: [CertificadosService, CertificadoMaestroService, EncryptionService, CertificadoMigrationService],
})
export class CertificadosModule {}