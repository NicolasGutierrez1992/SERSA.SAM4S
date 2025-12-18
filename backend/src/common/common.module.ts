import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingsService } from './services/app-settings.service';
import { AppSettingsController } from './controllers/app-settings.controller';
import { AppSetting } from './entities/app-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  providers: [AppSettingsService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService],
})
export class CommonModule {}
