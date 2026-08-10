import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingsService } from './services/app-settings.service';
import { AppSettingsController } from './controllers/app-settings.controller';
import { AppSetting } from './entities/app-setting.entity';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSetting]),
    forwardRef(() => AuditoriaModule),
  ],
  providers: [AppSettingsService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService],
})
export class CommonModule {}
