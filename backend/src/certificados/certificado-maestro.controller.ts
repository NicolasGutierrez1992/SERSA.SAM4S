import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
import type { Request } from 'express';
import { CertificadoMaestroService } from './certificado-maestro.service';
import { AfipFilesService } from '../afip/services/afip-files.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RequireAdmin } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditoriaService, AuditoriaAccion, AuditoriaEntidad } from '../auditoria/auditoria.service';
import {
  CertificadoMaestroResponseDto,
  CertificadoMaestroInfoDto,
} from './dto/certificado-maestro.dto';

@ApiTags('Certificados Maestro')
@Controller('certificados-maestro')
@ApiBearerAuth()
export class CertificadoMaestroController {
  constructor(
    private readonly certificadoMaestroService: CertificadoMaestroService,
    private readonly afipFilesService: AfipFilesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

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
    @Body('certificado_identificador') certificado_identificador: string | undefined,
    @CurrentUser('id') userId: number,
    @Req() req: Request,
  ): Promise<CertificadoMaestroResponseDto> {
    const resultado = await this.certificadoMaestroService.cargarCertificadoMaestro({
      pfxFile,
      password,
      certificado_identificador,
    });

    const ip = req.ip || (req as any).connection?.remoteAddress;
    await this.auditoriaService.log(
      userId,
      AuditoriaAccion.CREAR,
      AuditoriaEntidad.CERTIFICADO_MAESTRO,
      certificado_identificador ?? null,
      null,
      { archivo: pfxFile?.originalname, identificador: certificado_identificador },
      ip,
    );

    return resultado;
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

  @Post('upload-root-rti')
  @UseGuards(JwtAuthGuard)
  @RequireAdmin()
  @UseInterceptors(FileInterceptor('rootRtiFile', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cargar archivo Root_RTI.txt',
    description: 'Carga el archivo Root_RTI.txt encriptado en base de datos. Solo administradores.',
  })
  @ApiResponse({ status: 201, description: 'Root_RTI cargado correctamente' })
  @ApiResponse({ status: 400, description: 'Archivo inválido o faltante' })
  async uploadRootRti(
    @UploadedFile() file: Multer.File,
    @CurrentUser('id') userId: number,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string }> {
    if (!file) {
      throw new BadRequestException('Se requiere el archivo rootRtiFile');
    }
    if (!file.originalname.toLowerCase().endsWith('.txt')) {
      throw new BadRequestException('El archivo Root_RTI debe tener extensión .txt');
    }
    await this.afipFilesService.cargarArchivoRootRTI(file.buffer, file.originalname);

    const ip = req.ip || (req as any).connection?.remoteAddress;
    await this.auditoriaService.log(
      userId,
      AuditoriaAccion.CREAR,
      AuditoriaEntidad.CERTIFICADO_MAESTRO,
      'ROOT_RTI',
      null,
      { archivo: file.originalname },
      ip,
    );

    return { success: true, message: 'Root_RTI cargado y encriptado correctamente en base de datos' };
  }
}
