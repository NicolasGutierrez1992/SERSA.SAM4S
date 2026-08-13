import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BackupService } from './backup.service';
import { RequireAdmin } from '../auth/decorators/roles.decorator';

@ApiTags('backup')
@Controller('backup')
@ApiBearerAuth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('run')
  @RequireAdmin()
  // pg_dump completo es pesado en I/O/CPU — evita que se dispare en ráfaga.
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dispara un backup manual de la base de datos (solo admin)',
  })
  @ApiResponse({ status: 200, description: 'Backup ejecutado' })
  async run() {
    return await this.backupService.runBackup();
  }

  @Get('status')
  @RequireAdmin()
  @ApiOperation({ summary: 'Historial de los últimos backups (solo admin)' })
  @ApiResponse({ status: 200, description: 'Historial obtenido exitosamente' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Cantidad de registros (default 20)',
  })
  async status(@Query('limit') limit?: number) {
    return await this.backupService.getStatus(
      limit ? Number(limit) : undefined,
    );
  }
}
