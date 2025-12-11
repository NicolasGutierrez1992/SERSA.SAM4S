import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  Req, 
  Res, 
  UseGuards,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  UseInterceptors,
  UploadedFiles,
  Logger
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiQuery,
  ApiParam 
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CertificadosService } from './certificados.service';
import { DescargasService } from '../descargas/descargas.service';
import { UsersService } from '../users/users.service';
import { TimezoneService } from '../common/timezone.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RequireAdmin, RequireAuthenticated } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { 
  CreateDescargaDto, 
  UpdateEstadoDescargaDto,
  DownloadResponseDto 
} from '../descargas/dto/descarga.dto';
import { QueryDescargasDto } from '../descargas/dto/query-descargas.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/dto/user.dto';
import { EstadoDescarga, IDescarga } from '../shared/types';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';

@ApiTags('Certificados CRS')
@Controller('certificados')
@ApiBearerAuth()
export class CertificadosController {
  private readonly logger = new Logger(CertificadosController.name);
  
  constructor(
    private certificadosService: CertificadosService,
    private descargasService: DescargasService,
    private usersService: UsersService,
    private timezoneService: TimezoneService,
  ) {}

  /**
   * Descargar certificado CRS desde AFIP
   * Integra con servicios WSAA y WSCERT de AFIP
   */
  @Post('descargar')
  @ApiOperation({ 
    summary: 'Generar y descargar certificado CRS',
    description: 'Genera certificado CRS conectándose a AFIP (WSAA + WSCERT) y respetando límites de usuario'
  })  @ApiResponse({ 
    status: 201, 
    description: 'Certificado generado exitosamente',
    type: DownloadResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error AFIP' })
  @ApiResponse({ status: 403, description: 'Límite de descargas alcanzado' })  
  @RequireAuthenticated()
  @HttpCode(HttpStatus.CREATED)
  async descargarCertificado(
    @Body() createDescargaDto: CreateDescargaDto,
    @CurrentUser('id') userId: number,
    @Req() req: Request
  ): Promise<DownloadResponseDto> {
    const ip = req.ip || req.connection.remoteAddress;
    //Validar limites antes de enviar descargas
    
    return await this.certificadosService.generarCertificado(
      userId,
      createDescargaDto,
      ip
    );  
  }

  /**
   * Validar si usuario puede descargar (PREPAGO)
   */
  @Get('validar-descarga')
  @ApiOperation({ 
    summary: 'Validar si usuario puede descargar',
    description: 'Valida si el usuario tiene límite disponible para descargar certificados'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Validación completada',
    schema: {
      properties: {
        canDownload: { type: 'boolean' },
        message: { type: 'string' },
        userType: { type: 'string', enum: ['CUENTA_CORRIENTE', 'PREPAGO', 'SIN_LIMITE'] },
        limiteDisponible: { type: 'number' }
      }
    }
  })
  @RequireAuthenticated()
  async validarDescarga(
    @CurrentUser('id') userId: number
  ): Promise<any> {
    return await this.descargasService.canUserDownload(userId);
  }

  /**
   * Descargar archivo PEM del certificado
   */
  @Get('descargar/:downloadId/archivo')
  @ApiOperation({ 
    summary: 'Descargar archivo PEM',
    description: 'Descarga el archivo .pem del certificado generado'
  })
  @ApiParam({ name: 'downloadId', description: 'ID de la descarga' })  
  @ApiResponse({ status: 200, description: 'Archivo PEM', content: { 'application/x-pem-file': {} } })
  @RequireAuthenticated()
  async descargarArchivoPem(
    @Param('downloadId') downloadId: string,
    @CurrentUser() user: User,
    @CurrentUser('id') userId: number,
    @Res() res: Response
  ): Promise<void> {
    const archivo = await this.descargasService.getCertificadoPem(
      downloadId,
      userId,
      user.rol
    );

   
    res.set({
      'Content-Type': archivo.contentType,
      'Content-Disposition': `attachment; filename="${archivo.filename}"`
    });

    res.send(archivo.content);
  }

  /**
   * Obtener historial de descargas
   */
  @Get('descargas')
  @ApiOperation({ 
    summary: 'Historial de descargas',
    description: 'Lista descargas con filtros. Distribuidores ven solo las suyas, mayoristas ven las de sus distribuidores, admins ven todas.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página (default: 20)' })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String, description: 'Fecha desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String, description: 'Fecha hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'controladorId', required: false, type: String, description: 'Filtrar por controlador' })
  @ApiQuery({ name: 'estadoMayorista', required: false, enum: EstadoDescarga })
  @ApiQuery({ name: 'marca', required: false, type: String, description: 'Filtrar por marca' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de descargas',
    schema: {
      properties: {
        descargas: { type: 'array', items: { $ref: '#/components/schemas/Descarga' } },
        total: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }  
  })  @RequireAuthenticated()
  async getDescargas(
    @Query() queryDto: QueryDescargasDto,
    @CurrentUser('id') userId: number,
    @CurrentUser() user: User): Promise<{
    descargas: IDescarga[];
    total: number;
    totalPages: number;
  }> {    // Convertir queryDto para usar con DescargasService
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 50;
    
    const params = {
      ...queryDto,
      page,
      limit,
      usuarioId: user.rol === 3 ? userId : undefined // Solo distribuidores filtran por su ID
    };
    
    console.log('GET /certificados/descargas - params:', params);
    const result = await this.descargasService.getDescargas(params);
    console.log('GET /certificados/descargas - result:', result);
    
    return {
      descargas: result.descargas || [],
      total: result.total || 0,
      totalPages: Math.ceil((result.total || 0) / limit)
    };
  }

  /**
   * Obtener descargas de un usuario específico
   */
  @Get('descargas/usuario/:usuarioId')
  @ApiOperation({ summary: 'Descargas de un usuario', description: 'Lista todas las descargas de un usuario específico' })
  @ApiParam({ name: 'usuarioId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de descargas del usuario' })  @RequireAuthenticated()
  async getDescargasPorUsuario(
    @Param('usuarioId') usuarioId: number,
    @CurrentUser() user: User,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    // Si el usuario es distribuidor, solo puede consultar su propio id
    if (user.rol === 3 && user.id_usuario !== usuarioId) {
      throw new ForbiddenException('No tiene permiso para ver descargas de otros usuarios');
    }
    
    console.log(`GET /certificados/descargas/usuario/${usuarioId} - params:`, { usuarioId, page: pageNum, limit: limitNum });
    const result = await this.descargasService.getDescargas({ usuarioId, page: pageNum, limit: limitNum });
    console.log(`GET /certificados/descargas/usuario/${usuarioId} - result:`, result);
    
    return {
      descargas: result.descargas || [],
      total: result.total || 0,
      totalPages: Math.ceil((result.total || 0) / (limitNum || 50))
    };
  }

  /**
   * Obtener descargas asociadas a un mayorista específico
   */
  @Get('descargas/mayorista/:mayoristaId')
  @ApiOperation({ summary: 'Descargas por mayorista', description: 'Lista todas las descargas de los usuarios asociados a un mayorista' })
  @ApiParam({ name: 'mayoristaId', description: 'ID del mayorista' })
  @ApiResponse({ status: 200, description: 'Lista de descargas de los usuarios del mayorista' })
  @RequireAuthenticated()
  async getDescargasPorMayorista(
    @Param('mayoristaId') mayoristaId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    const result = await this.descargasService.getDescargas({ mayoristaId, page: pageNum, limit: limitNum });
    return {
      descargas: result.descargas || [],
      total: result.total || 0,
      totalPages: Math.ceil((result.total || 0) / (limitNum || 50))
    };
  }

  /**
   * Cambiar estado de descarga (facturación)
   */
  @Put('descargas/:downloadId/estado')
  @ApiOperation({ 
    summary: 'Cambiar estado de descarga',
    description: 'Mayoristas pueden cambiar estadoMayorista, solo admins pueden cambiar estadoDistribuidor'
  })
  @ApiParam({ name: 'downloadId', description: 'ID de la descarga' })  
  @ApiResponse({ 
    status: 200, 
    description: 'Estado actualizado'
  })  
  @ApiResponse({ status: 403, description: 'Sin permisos para cambiar estado' })  @RequireAuthenticated()
  async updateEstadoDescarga(
    @Param('downloadId') downloadId: string,
    @Body() updateEstadoDto: UpdateEstadoDescargaDto,
    @CurrentUser('id') userId: number,
    @CurrentUser() user: User,
    @Req() req: Request  ): Promise<IDescarga> {
    const ip = req.ip || req.connection.remoteAddress;
    //obtner usuario completo que realizó la descarga con el id usuario de la descarga
    
      console.log("Certificado Controller UserCurrent ",user);
    return await this.descargasService.updateEstadoDescarga(
      downloadId,
      updateEstadoDto,
      userId,
      user.rol,
      new Date(),
      ip
    );
  }

  /**
   * Obtener certificados disponibles (catálogo)
   */
  @Get()
  @ApiOperation({ 
    summary: 'Listar certificados disponibles',
    description: 'Catálogo de certificados CRS disponibles para descarga'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'controladorId', required: false, type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de certificados disponibles'  
  })  @RequireAuthenticated()
  async getCertificados(
    @Query('page') page: number = 10,
    @Query('limit') limit: number = 20,
    @Query('controladorId') controladorId?: string
  ) {
    // Por ahora retorna estructura básica
    // En el futuro puede conectar con catálogo AFIP
    const result = {
      certificados: [
        {
          id: 'cert-001',
          nombre: 'Certificado CRS Estándar',
          descripcion: 'Certificado para controladores fiscales CRS',
          vigencia: '2025-12-31',
          tipos_soportados: ['SESHIA', 'HASAR', 'EPSON']
        }
      ],
      total: 1,
      totalPages: 1
    };
    console.log('GET /certificados retornando:', result);
    return result;
  }

  /**
   * Estado del servicio AFIP
   */
  @Get('afip/status')
  @ApiOperation({ 
    summary: 'Estado de conexión AFIP',
    description: 'Verifica conectividad con servicios WSAA y WSCERT de AFIP'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado de servicios AFIP',
    schema: {
      properties: {
        wsaa: { type: 'string', enum: ['online', 'offline', 'error'] },
        wscert: { type: 'string', enum: ['online', 'offline', 'error'] },
        config_valid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } }
      }
    }  
  })  @RequireAuthenticated()
  async getAfipStatus() {
    // Implementar verificación real de estado AFIP
    // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
    return {
      wsaa: 'online',
      wscert: 'online', 
      config_valid: true,
      errors: [],
      last_check: new Date().toISOString()
    };
  }

  /**
   * Métricas de descargas del usuario actual
   */
  @Get('metricas')
  @ApiOperation({ 
    summary: 'Métricas personales de descargas',
    description: 'Estadísticas de descargas del usuario actual'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Métricas de descargas',
    schema: {
      properties: {
        descargasHoy: { type: 'number' },
        descargasSemana: { type: 'number' },
        descargasMes: { type: 'number' },
        pendienteFacturar: { type: 'number' },
        limiteDescargas: { type: 'number' },
        porcentajeLimite: { type: 'number' }
      }
    }  
  })  @RequireAuthenticated()  async getMetricasPersonales(
    @CurrentUser('id') userId: number,
    @CurrentUser() user: User  ) {
    // Obtener usuario completo desde la base de datos para asegurar limite_descargas
    const usuarioCompleto = await this.usersService.findOne(userId);
    
    // Usar zona horaria de Argentina
    const hoyArgentina = this.timezoneService.getNowArgentina();
    const inicioSemanaArgentina = this.timezoneService.getStartOfWeekArgentina();
    const inicioMesArgentina = this.timezoneService.getStartOfMonthArgentina();
    
    // Obtener fechas en formato YYYY-MM-DD para las queries
    const hoyString = this.timezoneService.formatDateToString(hoyArgentina);
    const semanaString = this.timezoneService.formatDateToString(inicioSemanaArgentina);
    const mesString = this.timezoneService.formatDateToString(inicioMesArgentina);
    
    // Obtener descargas filtrando por fecha en BD (con zona horaria Argentina)
    const descargasHoyResult = await this.descargasService.getDescargas({
      limit: 1000,
      usuarioId: userId,
      fechaDesde: hoyString,
      fechaHasta: hoyString
    });

    const descargasSemanaResult = await this.descargasService.getDescargas({
      limit: 1000,
      usuarioId: userId,
      fechaDesde: semanaString
    });

    const descargasMesResult = await this.descargasService.getDescargas({
      limit: 1000,
      usuarioId: userId,
      fechaDesde: mesString
    });

    // Obtener todas las descargas para contar las pendientes de facturación
    const todasDescargasResult = await this.descargasService.getDescargas({
      limit: 1000,
      usuarioId: userId,
      estadoMayorista: EstadoDescarga.PENDIENTE_FACTURAR
    });
    
    const descargasHoy = descargasHoyResult.descargas.length;
    const descargasSemana = descargasSemanaResult.descargas.length;
    const descargasMes = descargasMesResult.descargas.length;
    const pendienteFacturar = todasDescargasResult.descargas.length;

    this.logger.log(`Métricas para usuario ${userId} (ARG): Hoy=${descargasHoy}, Semana=${descargasSemana}, Mes=${descargasMes}, PendienteFacturar=${pendienteFacturar}, Límite=${usuarioCompleto.limite_descargas}`);
    
    return {
      descargasHoy,
      descargasSemana,
      descargasMes,
      pendienteFacturar,
      limiteDescargas: usuarioCompleto.limite_descargas,
      porcentajeLimite: Math.round((pendienteFacturar / usuarioCompleto.limite_descargas) * 100),
      horaServidor: this.timezoneService.formatDateTimeFull(new Date())
    };
  }

  @Post('upload')
@ApiOperation({ summary: 'Actualizar archivos de certificados', description: 'Permite a un administrador subir los archivos certificado.pfx, pwrCst.txt y Root_RTI.txt' })
@ApiResponse({ status: 200, description: 'Archivos actualizados correctamente' })
@RequireAdmin()
@UseInterceptors(FileFieldsInterceptor([
  { name: 'certificado', maxCount: 1 },
  { name: 'pwrCst', maxCount: 1 },
  { name: 'rootRti', maxCount: 1 },
], {
  storage: diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../../certs'));
    },
    filename: (req, file, cb) => {
      let filename = file.originalname;
      if (file.fieldname === 'certificado') filename = 'certificado.pfx';
      if (file.fieldname === 'pwrCst') filename = 'pwrCst.txt';
      if (file.fieldname === 'rootRti') filename = 'Root_RTI.txt';
      cb(null, filename);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (['certificado', 'pwrCst', 'rootRti'].includes(file.fieldname)) {
      cb(null, true);
    } else {
      cb(new Error('Campo de archivo no permitido'), false);
    }
  },
}))
async uploadCertFiles(@UploadedFiles() files: { certificado?: any[], pwrCst?: any[], rootRti?: any[] }) {
  await this.certificadosService.guardarArchivosCert(files);
  return { message: 'Archivos actualizados correctamente' };
}
}