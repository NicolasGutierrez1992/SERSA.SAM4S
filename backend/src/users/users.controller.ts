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
  Res,
  Req,
  SetMetadata,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, QueryUsersDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('usuarios')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 5]) // 1: Admin, 5: Técnico
  @ApiOperation({ summary: 'Crear nuevo usuario (admin y técnico)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente', type: User })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'CUIT o email ya existe' })
  async create(@Body() createUserDto: CreateUserDto, @Req() req: any): Promise<User> {
    const creatorUser = req.user;
    return await this.usersService.create(createUserDto, creatorUser);
  }  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 2, 4, 5]) // 1: Admin, 2: Mayorista, 4: Facturación, 5: Técnico
  @ApiOperation({ summary: 'Obtener lista de usuarios con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios obtenida exitosamente' })
  @ApiQuery({ name: 'rol', required: false, description: 'Filtrar por rol' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'id_mayorista', required: false, description: 'Filtrar por mayorista' })
  @ApiQuery({ name: 'page', required: false, description: 'Página (por defecto 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Elementos por página (por defecto 10)' })  async findAll(@Query() query: QueryUsersDto, @Req() req: any) {
    const currentUser = req.user;
    console.log('\n========== [UsersController][findAll] INICIANDO ==========');
    console.log('[UsersController][findAll] Query recibido:', query);
    console.log('[UsersController][findAll] Headers:', req.headers);
    console.log('[UsersController][findAll] URL:', req.url);
    
    if (currentUser) {
      console.log('[UsersController][findAll] ✅ Usuario autenticado:', {
        id: currentUser.id_usuario || currentUser.id,
        cuit: currentUser.cuit,
        rol: currentUser.id_rol || currentUser.rol,
        nombre: currentUser.nombre,
        mail: currentUser.mail,
        id_mayorista: currentUser.id_mayorista
      });
    } else {
      console.log('[UsersController][findAll] ❌ Usuario autenticado: NO PROPORCIONADO');
    }
    
    const result = await this.usersService.findAll(query, currentUser);
    
    // Log de salida
    console.log('[UsersController][findAll] Respuesta:', {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      cantidadUsuarios: result.data.length,
      idsUsuarios: result.data.map(u => u.id_usuario),
      usuarios: result.data.map(u => ({ id: u.id_usuario, nombre: u.nombre, id_rol: u.rol, id_mayorista: u.id_mayorista }))
    });
    console.log('========== [UsersController][findAll] FIN ==========\n');
    
    return result;
  }
  @Get('mayoristas')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 4]) // 1: Admin, 4: Facturación
  @ApiOperation({ summary: 'Obtener lista de mayoristas activos' })
  @ApiResponse({ status: 200, description: 'Lista de mayoristas', type: [User] })
  async getMayoristas(): Promise<User[]> {
    return await this.usersService.getMayoristas();
  }
  @Get('mayoristas/:id/distribuidores')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 2, 4]) // 1: Admin, 2: Mayorista, 4: Facturación
  @ApiOperation({ summary: 'Obtener distribuidores de un mayorista' })
  @ApiResponse({ status: 200, description: 'Lista de distribuidores', type: [User] })
  @ApiResponse({ status: 404, description: 'Mayorista no encontrado' })
  async getDistribuidoresByMayorista(
    @Param('id', ParseIntPipe) mayoristaId: number
  ): Promise<User[]> {
    return await this.usersService.getDistribuidoresByMayorista(mayoristaId);
  }
  @Get('export/csv')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 4]) // 1: Admin, 4: Facturación
  @ApiOperation({ summary: 'Exportar usuarios a CSV (solo admin)' })
  @ApiResponse({ status: 200, description: 'Archivo CSV generado' })
  @ApiQuery({ name: 'rol', required: false, description: 'Filtrar por rol' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'id_mayorista', required: false, description: 'Filtrar por mayorista' })
  async exportCSV(
    @Query() queryDto: QueryUsersDto,
    @Res() res: Response
  ): Promise<void> {
    const csv = await this.usersService.exportToCSV(queryDto);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
    res.send(csv);
  }  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 2, 4, 5]) // 1: Admin, 2: Mayorista, 4: Facturación, 5: Técnico
  @ApiOperation({ summary: 'Obtener usuario por ID (y validar permisos de edición)' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado con info de permisos' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para editar este usuario' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ): Promise<any> {
    const user = await this.usersService.findOne(id);
    const currentUser = req.user;
    
    // Determinar si el usuario actual puede editar este usuario
    let canEdit = (currentUser.rol === 1 || currentUser.rol === 5); // Admin o Tecnico siempre puede

    if (currentUser.rol === 2) {
      // Mayorista solo puede editar si el usuario a editar tiene el mismo id_mayorista
      canEdit = user.id_mayorista === currentUser.id_mayorista && user.rol === 3; // Solo distribuidores
    }
    
    return {
      ...user,
      canEdit,
      editableFields: canEdit ? this.getEditableFields(currentUser.rol) : []
    };
  }
  // Método privado para determinar qué campos puede editar cada rol
  private getEditableFields(rol: number): string[] {
    switch (rol) {
      case 1: // Admin
        return ['nombre', 'email', 'cuit', 'rol', 'status', 'limiteDescargas', 'id_mayorista', 'celular', 'tipo_descarga'];
      case 2: // Mayorista
        return ['limiteDescargas', 'tipo_descarga']; // Solo estos dos
      case 4: // Facturación
        return ['nombre', 'email', 'status', 'limiteDescargas', 'id_mayorista', 'celular', 'tipo_descarga'];
      case 5: // Técnico
        return ['nombre', 'email', 'cuit', 'status', 'limiteDescargas', 'id_mayorista', 'celular', 'tipo_descarga']; // Todo EXCEPTO rol
      default:
        return [];
    }
  }@Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 2, 4, 5]) // 1: Admin, 2: Mayorista, 4: Facturación, 5: Técnico
  @ApiOperation({ summary: 'Actualizar usuario (admin, técnico, mayoristas y facturación)' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente', type: User })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para editar este usuario' })
  @ApiResponse({ status: 409, description: 'Email ya existe' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any
  ): Promise<User> {
    const currentUser = req.user;
    return await this.usersService.update(id, updateUserDto, currentUser);
  }
  //Se utiliza en el blanqueo de contraseña desde el panel de administración
  @Patch(':id/reset-password')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1, 2, 5]) // 1: Admin, 2: Mayorista, 5: Técnico
  @ApiOperation({ summary: 'Resetear contraseña de usuario (solo admin o técnico)' })
  @ApiResponse({ status: 200, description: 'Contraseña reseteada' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async resetPassword(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.usersService.resetPassword(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @SetMetadata('roles', [1]) // 1: Admin
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar usuario (solo admin)' })
  @ApiResponse({ status: 204, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar (mayorista con distribuidores)' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.usersService.remove(id);
  }
}