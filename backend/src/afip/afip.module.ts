import { Module, forwardRef } from '@nestjs/common';
import { AfipService } from './afip.service';
import { LoggerService } from '../common/logger.service';
import { CertificadosModule } from '../certificados/certificados.module';

@Module({
  imports: [forwardRef(() => CertificadosModule)],
  providers: [AfipService, LoggerService],
  exports: [AfipService, LoggerService]
})
export class AfipModule {}