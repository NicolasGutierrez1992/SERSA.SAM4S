import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Mayorista } from './entities/mayorista.entity';
import { CompraPrepago } from './entities/compra-prepago.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Mayorista, CompraPrepago])
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}