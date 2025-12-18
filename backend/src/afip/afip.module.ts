import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AfipService } from './afip.service';
import { AfipFilesService } from './services/afip-files.service';
import { LoggerService } from '../common/logger.service';
import { CertificadosModule } from '../certificados/certificados.module';
import { AfipFile } from './entities/afip-file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AfipFile]),
    forwardRef(() => CertificadosModule),
  ],
  providers: [AfipService, AfipFilesService, LoggerService],
  exports: [AfipService, AfipFilesService, LoggerService],
})
export class AfipModule {}