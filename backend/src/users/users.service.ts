import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { User } from './entities/user.entity';
import { Mayorista } from './entities/mayorista.entity';
import { CreateUserDto, UpdateUserDto, QueryUsersDto, UserRole, UserStatus } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Mayorista)
    private readonly mayoristaRepository: Repository<Mayorista>,
  ) {}
  // ✅ Running in PRODUCTION mode with real AFIP integration

  async create(createUserDto: CreateUserDto, creatorUser?: any): Promise<User> {
    console.log('[UsersService][create] Entrada:', createUserDto);
    console.log('[UsersService][create] Usuario creador:', creatorUser?.rol);

    // ⭐ VALIDACIÓN: Verificar qué roles puede crear el usuario actual
    if (creatorUser) {
      const rolACrear = createUserDto.rol;
      
      // Admin (rol 1) puede crear cualquier rol incluido otro Admin y Facturación
      // Técnico (rol 5) puede crear Mayorista, Distribuidor, Técnico — NO Admin ni Facturación
      if (creatorUser.rol === 1 || creatorUser.rol === 5) {
        if (creatorUser.rol === 5 && rolACrear === UserRole.ADMINISTRADOR) {
          throw new ForbiddenException('Solo un administrador puede crear otro administrador');
        }
        if (creatorUser.rol === 5 && rolACrear === UserRole.FACTURACION) {
          throw new ForbiddenException('Solo un administrador puede crear usuarios de Facturación');
        }
        this.logger.log(`[create] creador rol=${creatorUser.rol} crea usuario rol=${rolACrear}`);
      } else {
        // Otros roles no pueden crear usuarios
        throw new ForbiddenException('No tienes permisos para crear usuarios');
      }
    }

    // Validar CUIT
    if (!/^\d{11}$/.test(createUserDto.cuit)) {
      throw new BadRequestException('El CUIT debe tener 11 dígitos numéricos');
    }
        if (!createUserDto.password || createUserDto.password.length < 10) {
      throw new BadRequestException('La contraseña debe tener al menos 10 caracteres');
    }

    // Verificar si el CUIT ya existe
    const existingUserByCuit = await this.userRepository.findOne({
      where: { cuit: createUserDto.cuit },
    });
    if (existingUserByCuit) {
      throw new ConflictException('Ya existe un usuario con este CUIT');
    }

    // Verificar si el email ya existe
    const existingUserByEmail = await this.userRepository.findOne({
      where: { mail: createUserDto.email },
    });
    if (existingUserByEmail) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    // Validar asociación de mayorista para distribuidores
    if (createUserDto.rol === UserRole.DISTRIBUIDOR) {
      if (!createUserDto.id_mayorista) {
        throw new BadRequestException('Los distribuidores deben tener un mayorista asociado');
      }
      // Validar en la tabla Mayoristas
      const mayorista = await this.mayoristaRepository.findOne({
        where: { id_mayorista: createUserDto.id_mayorista },
      });
      if (!mayorista) {
        throw new NotFoundException('El mayorista especificado no existe o no es válido');
      }
    }

    // ⭐ NUEVO: Los Técnicos siempre se crean con id_mayorista = 1 (SERSA)
    if (createUserDto.rol === UserRole.TECNICO) {
      createUserDto.id_mayorista = 1;
      console.log('[UsersService][create] Técnico creado con id_mayorista = 1 (SERSA)');
    }

    // Hash de la contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);    
    const user = this.userRepository.create({
      nombre: createUserDto.nombre,
      mail: createUserDto.email,
      cuit: createUserDto.cuit,
      password: hashedPassword,
      rol: createUserDto.rol,
      status: createUserDto.status || UserStatus.ACTIVO,
      id_mayorista: createUserDto.id_mayorista,
      limite_descargas: createUserDto.limiteDescargas !== undefined ? createUserDto.limiteDescargas : 0,
      must_change_password: true,
      celular: createUserDto.celular,
      tipo_descarga: createUserDto.tipo_descarga || 'PREPAGO',
    });
    const savedUser = await this.userRepository.save(user);
    console.log('[UsersService][create] Salida:', savedUser);
    return savedUser;
  }
  async findAll(queryDto: QueryUsersDto = {}, currentUser?: any) {
    const { page = 1, limit = 100, rol, status, id_mayorista } = queryDto;

    const where: FindOptionsWhere<User> = {};
    // Mayoristas only see users belonging to their own mayorista
    if (currentUser?.rol === 2) where.id_mayorista = currentUser.id_mayorista;
    if (rol !== undefined) where.rol = +rol as UserRole;
    if (status !== undefined) where.status = +status;
    if (id_mayorista !== undefined) where.id_mayorista = +id_mayorista;

    const [data, total] = await this.userRepository.findAndCount({
      where,
      select: [
        'id_usuario', 'cuit', 'nombre', 'mail', 'rol', 'status', 'limite_descargas',
        'must_change_password', 'ultimo_login', 'id_mayorista', 'created_at', 'updated_at',
        'celular', 'tipo_descarga', 'notification_limit',
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { nombre: 'ASC' },
    });

    // Resolve mayorista names with a single targeted query (only the page's unique ids)
    const mayoristaIds = [...new Set(data.map(u => u.id_mayorista).filter(Boolean))] as number[];
    const mayoristaMap = new Map<number, string>();
    if (mayoristaIds.length > 0) {
      const mayoristas = await this.userRepository.find({
        where: { id_usuario: In(mayoristaIds), rol: UserRole.MAYORISTA },
        select: ['id_usuario', 'nombre'],
      });
      mayoristas.forEach(m => mayoristaMap.set(m.id_usuario, m.nombre));
    }

    return {
      data: data.map(u => ({
        ...u,
        nombreMayorista: u.id_mayorista ? (mayoristaMap.get(u.id_mayorista) ?? null) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async findOne(id: number): Promise<User> {
    console.log('[UsersService][findOne] Entrada:', id);
    const user = await this.userRepository.findOne({
      where: { id_usuario: id },
      select: {
        id_usuario: true,
        cuit: true,
        nombre: true,
        mail: true,
        rol: true,
        status: true,
        limite_descargas: true,
        must_change_password: true,
        ultimo_login: true,
        id_mayorista: true,
        created_at: true,
        updated_at: true,
        celular: true,
        tipo_descarga: true,
        notification_limit: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    console.log('[UsersService][findOne] Salida:', user);
    return user;
  }
  async findByCuit(cuit: string): Promise<User | null> {
    const trimmedCuit = String(cuit).trim();
    const user = await this.userRepository.findOne({
      where: { cuit: trimmedCuit },
    });
    if (!user) {
      this.logger.warn('[findByCuit] Usuario no encontrado para el CUIT proporcionado');
    }
    return user;
  }  
  async findByMail(mail: string): Promise<User | null> {
    console.log('[UsersService][findByMail] Entrada:', mail);
    const user = await this.userRepository.findOne({
      where: { mail },
    });
    console.log('[UsersService][findByMail] Salida:', user);
    return user;
  } 
   async update(id: number, updateUserDto: UpdateUserDto, currentUser?: any): Promise<User> {
    console.log('[UsersService][update] Entrada:', id, updateUserDto, currentUser);
    const user = await this.findOne(id);

    // ⭐ VALIDACIÓN POR ROL
    if (currentUser) {
      // Mayorista (rol 2): Solo puede editar distribuidores del mismo mayorista
      if (currentUser.rol === 2) { // Mayorista
        // 1. Solo puede editar si el usuario tiene el mismo id_mayorista
        if (user.id_mayorista !== currentUser.id_mayorista) {
          throw new BadRequestException('No tienes permisos para editar usuarios de otro mayorista');
        }
        
        // 2. Solo puede editar si el usuario es distribuidor (rol 3)
        if (user.rol !== 3) {
          throw new BadRequestException('Los mayoristas solo pueden editar distribuidores');
        }
        
        // 3. Solo puede editar estos campos: limiteDescargas y tipo_descarga
        const allowedFields = ['limiteDescargas', 'tipo_descarga'];
        const attemptedFields = Object.keys(updateUserDto).filter(key => updateUserDto[key] !== undefined);
        const unallowedFields = attemptedFields.filter(field => !allowedFields.includes(field));
        
        if (unallowedFields.length > 0) {
          throw new BadRequestException(`No tienes permisos para editar los campos: ${unallowedFields.join(', ')}`);
        }
      }
      // Técnico (rol 5): Puede editar todos los usuarios, excepto el campo ROL
      else if (currentUser.rol === 5) {
        if (updateUserDto.rol !== undefined) {
          throw new BadRequestException('No tienes permisos para cambiar el rol de un usuario');
        }
        console.log(`[UsersService][update] ✅ Técnico editando usuario`);
      }
      // Admin (rol 1): Puede editar todo
      else if (currentUser.rol === 1) {
        console.log(`[UsersService][update] ✅ Admin editando usuario`);
      }
      // Otros roles no pueden editar
      else if (currentUser.rol !== 1 && currentUser.rol !== 4) {
        throw new BadRequestException('No tienes permisos para editar usuarios');
      }
    }

    // Verificar email único si se está actualizando
    if (updateUserDto.email && updateUserDto.email !== user.mail) {
      const existingUser = await this.userRepository.findOne({
        where: { mail: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Ya existe un usuario con este email');
      }
    }

    // Validar mayorista si se está actualizando
    if (updateUserDto.id_mayorista !== undefined && user.rol === UserRole.DISTRIBUIDOR) {
      if (updateUserDto.id_mayorista) {
        const mayorista = await this.mayoristaRepository.findOne({
          where: { id_mayorista: updateUserDto.id_mayorista },
        });
        if (!mayorista) {
          throw new NotFoundException('El mayorista especificado no existe o no es válido');
        }
      } else {
        throw new BadRequestException('Los distribuidores deben tener un mayorista asociado');
      }
    }

    // Mapear campos del DTO a campos de la BD
    const updateData: any = {};
    if (updateUserDto.nombre) updateData.nombre = updateUserDto.nombre;
    if (updateUserDto.email) updateData.mail = updateUserDto.email;
    if (updateUserDto.rol) updateData.id_rol = updateUserDto.rol;
    if (updateUserDto.status !== undefined) updateData.status = updateUserDto.status;    if (updateUserDto.id_mayorista !== undefined) updateData.id_mayorista = updateUserDto.id_mayorista;
    if (updateUserDto.limiteDescargas !== undefined) updateData.limite_descargas = updateUserDto.limiteDescargas;
    if (updateUserDto.celular !== undefined) updateData.celular = updateUserDto.celular;
    if (updateUserDto.tipo_descarga !== undefined) updateData.tipo_descarga = updateUserDto.tipo_descarga;
    
    // ⭐ NUEVO: Validar notification_limit - Solo admin puede editarlo, y solo para mayoristas (rol=2)
    if (updateUserDto.notification_limit !== undefined) {
      // Solo admin (rol=1) puede editar notification_limit
      if (!currentUser || currentUser.rol !== 1) {
        throw new BadRequestException('Solo administradores pueden editar el límite de notificación');
      }
      
      // notification_limit solo se puede editar para usuarios mayoristas (rol=2)
      if (user.rol !== 2) {
        throw new BadRequestException('El límite de notificación solo se puede asignar a usuarios mayoristas (rol=2)');
      }
      
      updateData.notification_limit = updateUserDto.notification_limit;
    }
    
    console.log('[UsersService][update] updateData:', updateData);
    Object.assign(user, updateData);
    console.log('[UsersService][update] user después de assign:', user);
    const updatedUser = await this.userRepository.save(user);
    console.log('[UsersService][update] Salida:', updatedUser);
    return updatedUser;
  }

  async updatePassword(id: number, newPassword: string, mustChange = false): Promise<void> {
    console.log('[UsersService][updatePassword] Entrada:', id, newPassword, mustChange);
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    await this.userRepository.update({ id_usuario: id }, {
      password: hashedPassword,
      must_change_password: mustChange,
    });
    console.log('[UsersService][updatePassword] Salida: OK');
  }

  async updateLastLogin(id: number): Promise<void> {
    console.log('[UsersService][updateLastLogin] Entrada:', id);
    const user = await this.userRepository.findOne({ where: { id_usuario: id } });
    if (!user) return;
    // Si el usuario tiene la contraseña por defecto, debe cambiarla
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'certificados';
    const isDefault = await bcrypt.compare(defaultPassword, user.password);
    if (isDefault) {
      user.must_change_password = true;
      await this.userRepository.save(user);
    } else {
      user.must_change_password = false;
      await this.userRepository.save(user);
    }    // Actualizar último login
    // Usar fecha actual en zona horaria de Argentina (se almacena en UTC)
    user.ultimo_login = new Date();
    await this.userRepository.save(user);
    console.log('[UsersService][updateLastLogin] Salida: OK');
  }

  async resetPassword(id: number, rol: number): Promise<void> {
    console.log('[UsersService][resetPassword] UserEditable:', id);
    console.log('[UsersService][resetPassword] rolCurrentUser:', rol);

    const user = await this.userRepository.findOne({ where: { id_usuario: id } });
    if (!user) throw new Error('Usuario no encontrado');
    // ADMIN puede resetear a cualquier usuario 
    if(rol !== UserRole.ADMINISTRADOR ){
      //A los usuarios Administradores y Facturacion No se le puede resetar la contraseña
      if (user.rol === UserRole.ADMINISTRADOR || user.rol === UserRole.FACTURACION) {
        throw new BadRequestException('No se puede resetear la contraseña de este usuario');
      }
    }
    // Usar contraseña por defecto del .env
    const nuevaPassword = process.env.DEFAULT_USER_PASSWORD || 'certificados';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(nuevaPassword, saltRounds);
    

    user.password = hashedPassword;
    user.must_change_password = true;
    await this.userRepository.save(user);
    console.log('[UsersService][resetPassword] Salida: OK');
  }

  async remove(id: number): Promise<void> {
    console.log('[UsersService][remove] Entrada:', id);
    const user = await this.findOne(id);
    
    // Verificar si el usuario es mayorista y tiene distribuidores asociados
    if (user.rol === UserRole.MAYORISTA) {
      const distribuidores = await this.userRepository.count({
        where: { id_mayorista: id },
      });
      if (distribuidores > 0) {
        throw new BadRequestException('No se puede eliminar un mayorista que tiene distribuidores asociados');
      }
    }

    await this.userRepository.remove(user);
    console.log('[UsersService][remove] Salida: OK');
  }

  async getMayoristas(): Promise<User[]> {
    console.log('[UsersService][getMayoristas] Entrada');
    const result = await this.userRepository.find({
      where: { rol: UserRole.MAYORISTA, status: 1 },
      select: ['id_usuario', 'nombre', 'cuit'],
      order: { nombre: 'ASC' },
    });
    console.log('[UsersService][getMayoristas] Salida:', result);
    return result;
  }

  async getDistribuidoresByMayorista(mayoristaId: number): Promise<User[]> {
    console.log('[UsersService][getDistribuidoresByMayorista] Entrada:', mayoristaId);
    const result = await this.userRepository.find({
      where: { id_mayorista: mayoristaId, rol: UserRole.DISTRIBUIDOR },
      select: ['id_usuario', 'nombre', 'cuit', 'mail', 'status'],
      order: { nombre: 'ASC' },
    });
    console.log('[UsersService][getDistribuidoresByMayorista] Salida:', result);
    return result;
  }

  async exportToCSV(queryDto: QueryUsersDto = {}): Promise<string> {
    console.log('[UsersService][exportToCSV] Entrada:', queryDto);
    const { data: users } = await this.findAll({ ...queryDto, page: 1, limit: 10000 });
    
    const headers = 'ID,CUIT,Nombre,Email,Rol,Estado,Límite Descargas,Mayorista,Creado\n';
    const rows = users.map(user => {
      const rolText = this.getRolText(user.rol);
      const statusText = user.status === 1 ? 'Activo' : 'Inactivo';
      const mayoristaName = ''; // Sin relación por ahora
      
      return `${user.id_usuario},"${user.cuit}","${user.nombre}","${user.mail}","${rolText}","${statusText}",${user.limite_descargas},"${mayoristaName}","${user.created_at.toISOString()}"`;
    }).join('\n');
    
    console.log('[UsersService][exportToCSV] Salida: CSV generado');
    return headers + rows;
  }

  /**
   * Incrementar límite de descargas para usuarios PREPAGO
   * Se usa cuando se realiza un prepago para agregar más descargas disponibles
   */
  async incrementarLimiteDescargas(
    usuarioId: number,
    cantidad: number
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id_usuario: usuarioId }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Solo para usuarios PREPAGO
    if (user.tipo_descarga !== 'PREPAGO') {
      throw new BadRequestException(
        'Solo se pueden incrementar descargas en usuarios con tipo PREPAGO'
      );
    }

    const nuevoLimite = user.limite_descargas + cantidad;

    await this.userRepository.update(
      { id_usuario: usuarioId },
      { limite_descargas: nuevoLimite }
    );

    console.log(
      `[UsersService][incrementarLimiteDescargas] Límite de descarga incrementado: ${user.limite_descargas} → ${nuevoLimite} (Usuario: ${usuarioId})`
    );

    return this.findOne(usuarioId);
  }

  /**
   * Actualizar tipo de descarga de un usuario
   * Permite cambiar entre CUENTA_CORRIENTE y PREPAGO
   * No se permite para Admin ni Mayorista
   */
  async updateTipoDescarga(
    usuarioId: number,
    tipo: 'CUENTA_CORRIENTE' | 'PREPAGO'
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id_usuario: usuarioId }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar que no sea Admin ni Mayorista
    if (user.rol === 1 || user.rol === 2) {
      throw new BadRequestException(
        'No se puede cambiar tipo_descarga a administradores o mayoristas'
      );
    }

    await this.userRepository.update(
      { id_usuario: usuarioId },
      { tipo_descarga: tipo }
    );

    console.log(
      `[UsersService][updateTipoDescarga] Tipo de descarga actualizado: ${user.tipo_descarga} → ${tipo} (Usuario: ${usuarioId})`
    );

    return this.findOne(usuarioId);
  }
  private getRolText(rol: number): string {
    const roles = {
      1: 'Administrador',
      2: 'Mayorista', 
      3: 'Distribuidor',
      4: 'Facturación',
      5: 'Técnico',
    };
    return roles[rol] || 'Desconocido';
  }
}