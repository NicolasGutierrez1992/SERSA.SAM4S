import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { SharedAuthModule } from '../auth/shared-auth.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    SharedAuthModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}