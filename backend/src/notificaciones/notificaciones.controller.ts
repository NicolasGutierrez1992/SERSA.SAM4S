import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';
import { CreateNotificacionDto, QueryNotificacionesDto } from './dto/notificacion.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireAdmin } from '../auth/decorators/roles.decorator';

@ApiTags('notificaciones')
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Post()
  @RequireAdmin()
  @ApiOperation({ summary: 'Crear nueva notificación (solo admin)' })
  @ApiResponse({ status: 201, description: 'Notificación creada exitosamente' })
  async create(@Body() createNotificacionDto: CreateNotificacionDto) {
    return await this.notificacionesService.create(createNotificacionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener notificaciones del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones obtenida exitosamente' })
  async findMine(
    @CurrentUser('sub') userId: number,
    @Query() queryDto: QueryNotificacionesDto
  ) {
    return await this.notificacionesService.findByUser(userId, queryDto);
  }

  @Get('all')
  @RequireAdmin()
  @ApiOperation({ summary: 'Obtener todas las notificaciones (solo admin)' })
  @ApiResponse({ status: 200, description: 'Lista de todas las notificaciones' })
  async findAll(@Query() queryDto: QueryNotificacionesDto) {
    return await this.notificacionesService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener notificación por ID' })
  @ApiResponse({ status: 200, description: 'Notificación encontrada' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async findOne(@Param('id') id: string) {
    return await this.notificacionesService.findOne(id);
  }

  @Patch(':id/sent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar notificación como enviada' })
  @ApiResponse({ status: 204, description: 'Notificación marcada como enviada' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async markAsSent(@Param('id') id: string) {
    await this.notificacionesService.markAsSent(id);
  }
  @Delete(':id')
  @RequireAdmin()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar notificación (solo admin)' })
  @ApiResponse({ status: 204, description: 'Notificación eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async remove(@Param('id') id: string) {
    await this.notificacionesService.remove(id);
  }

  @Post('cleanup')
  @RequireAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Limpiar notificaciones antiguas (solo admin)' })
  @ApiResponse({ status: 200, description: 'Limpieza realizada exitosamente' })
  async cleanup(@Query('dias_retencion') diasRetencion: number = 90) {
    const eliminadas = await this.notificacionesService.cleanup(diasRetencion);
    return { 
      message: 'Limpieza de notificaciones completada',
      notificaciones_eliminadas: eliminadas
    };
  }
}