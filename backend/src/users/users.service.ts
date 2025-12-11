import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Mayorista } from './entities/mayorista.entity';
import { CreateUserDto, UpdateUserDto, QueryUsersDto, UserRole, UserStatus } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Mayorista)
    private readonly mayoristaRepository: Repository<Mayorista>,
  ) {
    console.log('TEST LOG: UsersService constructor ejecutado');
  }

  // ✅ Running in PRODUCTION mode with real AFIP integration

  async create(createUserDto: CreateUserDto): Promise<User> {
    console.log('[UsersService][create] Entrada:', createUserDto);
    // Validar CUIT
    if (!/^\d{11}$/.test(createUserDto.cuit)) {
      throw new BadRequestException('El CUIT debe tener 11 dígitos numéricos');
    }
        // Validar longitud de contraseña
    if (!createUserDto.password || createUserDto.password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
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
    }    // Hash de la contraseña
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
      limite_descargas: createUserDto.limiteDescargas || 5,
      must_change_password: true,
      celular: createUserDto.celular,
      tipo_descarga: createUserDto.tipo_descarga || 'CUENTA_CORRIENTE',
    });
    const savedUser = await this.userRepository.save(user);
    console.log('[UsersService][create] Salida:', savedUser);
    return savedUser;
  }

  async findAll(queryDto: QueryUsersDto = {}, currentUser?: any) {
    console.log('[UsersService][findAll] Entrada:', queryDto, currentUser);
    const { page = 10, limit = 100, rol, status, id_mayorista } = queryDto;    // Obtener todos los usuarios para armar jerarquía y nombreMayorista
    const allUsers = await this.userRepository.find({
      select: [
        'id_usuario', 'cuit', 'nombre', 'mail', 'rol', 'status', 'limite_descargas',
        'must_change_password', 'ultimo_login', 'id_mayorista', 'created_at', 'updated_at', 'celular', 'tipo_descarga'
      ]
    });
    // Mapeo id_usuario -> nombre para lookup rápido
    const mayoristaMap = new Map<number, string>();
    allUsers.filter(u => ( u.rol === 3) && (u.id_mayorista === currentUser.id_mayorista)).forEach(m => {
      mayoristaMap.set(m.id_usuario, m.nombre);
    });
    // Lista plana con nombreMayorista
    const usuariosConMayorista = allUsers.map(u => ({
      ...u,
      nombreMayorista: u.id_mayorista ? mayoristaMap.get(u.id_mayorista) || null : null
    }));
    // Filtros y paginación sobre la lista plana
    let filtered = usuariosConMayorista;
    // Si el usuario autenticado es mayorista, solo puede ver sus propios distribuidores (usuarios con id_mayorista igual a su id)
    if ((currentUser?.rol === 2 || currentUser?.rol === 2)) {
      filtered = filtered.filter(u => u.id_mayorista === (currentUser.id_mayorista));
    }
    if (rol !== undefined) filtered = filtered.filter(u => u.rol === +rol);
    if (status !== undefined) filtered = filtered.filter(u => u.status === +status);
    if (id_mayorista !== undefined) filtered = filtered.filter(u => u.id_mayorista === +id_mayorista);
    // Paginación
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);
    
    const result = {
      data: paged,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
    console.log('[UsersService][findAll] Salida:', result);
    return result;
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
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    console.log('[UsersService][findOne] Salida:', user);
    return user;
  }async findByCuit(cuit: string): Promise<User | null> {
    console.log('\n========================================');
    console.log('[UsersService][findByCuit] INICIANDO BÚSQUEDA');
    console.log('========================================');
    console.log('Entrada CUIT:', cuit);
    console.log('Tipo:', typeof cuit, '| Longitud:', cuit.length);
    
    // Buscar con trim y conversión a string
    const trimmedCuit = String(cuit).trim();
    console.log('CUIT trimmed:', trimmedCuit);
    console.log('Buscando en tabla "users" con condición: cuit = "' + trimmedCuit + '"');    const user = await this.userRepository.findOne({
      where: { cuit: trimmedCuit },
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
        password: true,
        tipo_descarga: true,
      },
    });
    
    if (!user) {
      console.log('\n⚠️  USUARIO NO ENCONTRADO - Listando todos los usuarios en la BD:');
      const allUsers = await this.userRepository.find({
        select: ['id_usuario', 'cuit', 'nombre', 'mail', 'rol', 'status'],
      });
      console.log('Total de usuarios en BD:', allUsers.length);
      console.log('Usuarios registrados:');
      allUsers.forEach(u => {
        console.log(`  - ID: ${u.id_usuario}, CUIT: "${u.cuit}", Nombre: ${u.nombre}, Email: ${u.mail}, Rol: ${u.rol}, Status: ${u.status}`);
      });
    } else {
      console.log('\n✅ USUARIO ENCONTRADO');
      console.log(`ID: ${user.id_usuario}`);
      console.log(`CUIT: ${user.cuit}`);
      console.log(`Nombre: ${user.nombre}`);
      console.log(`Email: ${user.mail}`);
      console.log(`Rol: ${user.rol}`);
      console.log(`Status: ${user.status}`);
    }
    
    console.log('========================================\n');
    return user;
  }
  async findByMail(mail: string): Promise<User | null> {
    console.log('[UsersService][findByMail] Entrada:', mail);
    const user = await this.userRepository.findOne({
      where: { mail },
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
        password: true,
        tipo_descarga: true,
      },
    });
    console.log('[UsersService][findByMail] Salida:', user);
    return user;
  }
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    console.log('[UsersService][update] Entrada:', id, updateUserDto);
    const user = await this.findOne(id);

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
    }    // Mapear campos del DTO a campos de la BD
    const updateData: any = {};
    if (updateUserDto.nombre) updateData.nombre = updateUserDto.nombre;
    if (updateUserDto.email) updateData.mail = updateUserDto.email;
    if (updateUserDto.rol) updateData.id_rol = updateUserDto.rol;
    if (updateUserDto.status !== undefined) updateData.status = updateUserDto.status;
    if (updateUserDto.id_mayorista !== undefined) updateData.id_mayorista = updateUserDto.id_mayorista;
    if (updateUserDto.limiteDescargas !== undefined) updateData.limite_descargas = updateUserDto.limiteDescargas;
    if (updateUserDto.celular !== undefined) updateData.celular = updateUserDto.celular;
    if (updateUserDto.tipo_descarga !== undefined) updateData.tipo_descarga = updateUserDto.tipo_descarga;
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
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'sersa2025';
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

  async resetPassword(id: number): Promise<void> {
    console.log('[UsersService][resetPassword] Entrada:', id);
    const user = await this.userRepository.findOne({ where: { id_usuario: id } });
    if (!user) throw new Error('Usuario no encontrado');
    // Usar contraseña por defecto del .env
    const nuevaPassword = process.env.DEFAULT_USER_PASSWORD || 'sersa2025';
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
    };
    return roles[rol] || 'Desconocido';
  }
}