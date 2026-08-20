import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingsService } from './services/app-settings.service';
import { MailService } from './services/mail.service';
import { AppSettingsController } from './controllers/app-settings.controller';
import { AppSetting } from './entities/app-setting.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSetting]),
    forwardRef(() => AuditoriaModule),
  ],
  providers: [AppSettingsService, MailService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService, MailService],
})
export class CommonModule {}
