import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { 
  ApiBearerAuth, 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes 
} from '@nestjs/swagger';
import type { Multer } from 'multer';
import { CertificadoMaestroService } from './certificado-maestro.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RequireAdmin } from '../auth/decorators/roles.decorator';
import {
  CertificadoMaestroResponseDto,
  CertificadoMaestroInfoDto,
} from './dto/certificado-maestro.dto';

@ApiTags('Certificados Maestro')
@Controller('certificados-maestro')
@ApiBearerAuth()
export class CertificadoMaestroController {
  constructor(private readonly certificadoMaestroService: CertificadoMaestroService) {}

  /**
   * Subir/actualizar certificado maestro .pfx
   * Solo administradores pueden realizar esta acción
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @RequireAdmin()
  @UseInterceptors(FileInterceptor('pfxFile', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Cargar certificado maestro .pfx',
    description:
      'Carga un nuevo certificado .pfx encriptado. El archivo se almacena encriptado en la base de datos. Solo administradores pueden realizar esta acción.',
  })
  @ApiResponse({
    status: 201,
    description: 'Certificado maestro cargado exitosamente',
    type: CertificadoMaestroResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o contraseña incorrecta',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo administradores pueden cargar certificados',
  })  @HttpCode(HttpStatus.CREATED)
  async uploadCertificado(
    @UploadedFile() pfxFile: Multer.File,
    @Body('password') password: string,
    @Body('certificado_identificador') certificado_identificador?: string,
  ): Promise<CertificadoMaestroResponseDto> {
    return await this.certificadoMaestroService.cargarCertificadoMaestro({
      pfxFile,
      password,
      certificado_identificador,
    });
  }

  /**
   * Obtener información del certificado maestro
   * Solo administradores pueden ver la información completa
   */
  @Get('info')
  @UseGuards(JwtAuthGuard)
  @RequireAdmin()
  @ApiOperation({
    summary: 'Obtener información del certificado maestro',
    description:
      'Retorna información sobre el certificado maestro configurado. No retorna la contraseña. Solo administradores pueden acceder.',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del certificado maestro',
    type: CertificadoMaestroInfoDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo administradores pueden acceder',
  })
  async getInfo(): Promise<CertificadoMaestroInfoDto> {
    return await this.certificadoMaestroService.obtenerInfoCertificadoMaestro();
  }
}
