import { Module } from '@nestjs/common';
import { AfipService } from './afip.service';
import { LoggerService } from '../common/logger.service';

@Module({
  providers: [AfipService, LoggerService],
  exports: [AfipService, LoggerService]
})
export class AfipModule {}