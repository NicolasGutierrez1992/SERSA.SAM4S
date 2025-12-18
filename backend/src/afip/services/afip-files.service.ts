import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AfipFile } from '../entities/afip-file.entity';

export interface AfipFileInfo {
  id: string;
  file_type: string;
  file_name: string;
  file_size: number;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
  uploaded_at: Date;
}

@Injectable()
export class AfipFilesService {
  private readonly logger = new Logger(AfipFilesService.name);
  private readonly ROOT_RTI_ID = 'ROOT_RTI';

  constructor(
    @InjectRepository(AfipFile)
    private readonly afipFileRepository: Repository<AfipFile>,
  ) {}

  /**
   * Obtener el archivo Root_RTI
   * @returns Buffer con el contenido del archivo
   */
  async obtenerArchivoRootRTI(): Promise<Buffer> {
    try {
      const archivo = await this.afipFileRepository.findOne({
        where: { id: this.ROOT_RTI_ID, activo: true },
      });

      if (!archivo) {
        this.logger.error('Archivo Root_RTI no encontrado o inactivo');
        throw new NotFoundException('Archivo Root_RTI no configurado en la base de datos');
      }

      this.logger.debug(`Root_RTI obtenido exitosamente (${archivo.file_size} bytes)`);
      return archivo.file_data;
    } catch (error) {
      this.logger.error('Error obteniendo Root_RTI', error);
      throw error;
    }
  }

  /**
   * Cargar o actualizar el archivo Root_RTI
   * @param fileBuffer Buffer del archivo
   * @param fileName Nombre original del archivo
   */
  async cargarArchivoRootRTI(
    fileBuffer: Buffer,
    fileName: string = 'Root_RTI.txt',
  ): Promise<void> {
    try {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new BadRequestException('El archivo no puede estar vacío');
      }

      this.logger.log(`Cargando Root_RTI (${fileBuffer.length} bytes)`);

      // Buscar si ya existe
      const archivoExistente = await this.afipFileRepository.findOne({
        where: { id: this.ROOT_RTI_ID },
      });

      if (archivoExistente) {
        // Actualizar existente
        archivoExistente.file_data = fileBuffer;
        archivoExistente.file_name = fileName;
        archivoExistente.file_size = fileBuffer.length;
        archivoExistente.updated_at = new Date();
        await this.afipFileRepository.save(archivoExistente);
        this.logger.log('Root_RTI actualizado exitosamente en BD');
      } else {
        // Crear nuevo
        const nuevoArchivo = this.afipFileRepository.create({
          id: this.ROOT_RTI_ID,
          file_type: 'ROOT_RTI',
          file_data: fileBuffer,
          file_name: fileName,
          file_size: fileBuffer.length,
          activo: true,
          uploaded_at: new Date(),
        });
        await this.afipFileRepository.save(nuevoArchivo);
        this.logger.log('Root_RTI cargado exitosamente en BD');
      }
    } catch (error) {
      this.logger.error('Error cargando Root_RTI', error);
      throw error;
    }
  }

  /**
   * Obtener información del archivo Root_RTI sin los datos binarios
   */
  async obtenerInfoArchivoRootRTI(): Promise<AfipFileInfo | null> {
    try {
      const archivo = await this.afipFileRepository.findOne({
        where: { id: this.ROOT_RTI_ID },
      });

      if (!archivo) {
        return null;
      }

      return {
        id: archivo.id,
        file_type: archivo.file_type,
        file_name: archivo.file_name,
        file_size: archivo.file_size,
        activo: archivo.activo,
        created_at: archivo.created_at,
        updated_at: archivo.updated_at,
        uploaded_at: archivo.uploaded_at,
      };
    } catch (error) {
      this.logger.error('Error obteniendo información de Root_RTI', error);
      throw error;
    }
  }

  /**
   * Verificar si existe Root_RTI en BD
   */
  async existeArchivoRootRTI(): Promise<boolean> {
    try {
      const archivo = await this.afipFileRepository.findOne({
        where: { id: this.ROOT_RTI_ID, activo: true },
      });
      return !!archivo;
    } catch (error) {
      this.logger.error('Error verificando existencia de Root_RTI', error);
      return false;
    }
  }

  /**
   * Obtener información de cualquier archivo AFIP
   */
  async obtenerInfoArchivo(fileType: string): Promise<AfipFileInfo | null> {
    try {
      const archivo = await this.afipFileRepository.findOne({
        where: { file_type: fileType, activo: true },
      });

      if (!archivo) {
        return null;
      }

      return {
        id: archivo.id,
        file_type: archivo.file_type,
        file_name: archivo.file_name,
        file_size: archivo.file_size,
        activo: archivo.activo,
        created_at: archivo.created_at,
        updated_at: archivo.updated_at,
        uploaded_at: archivo.uploaded_at,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo información del archivo ${fileType}`, error);
      throw error;
    }
  }

  /**
   * Listar todos los archivos AFIP
   */
  async listarArchivos(): Promise<AfipFileInfo[]> {
    try {
      const archivos = await this.afipFileRepository.find({
        where: { activo: true },
        order: { updated_at: 'DESC' },
      });

      return archivos.map((archivo) => ({
        id: archivo.id,
        file_type: archivo.file_type,
        file_name: archivo.file_name,
        file_size: archivo.file_size,
        activo: archivo.activo,
        created_at: archivo.created_at,
        updated_at: archivo.updated_at,
        uploaded_at: archivo.uploaded_at,
      }));
    } catch (error) {
      this.logger.error('Error listando archivos AFIP', error);
      throw error;
    }
  }

  /**
   * Desactivar un archivo (soft delete)
   */
  async desactivarArchivo(id: string): Promise<void> {
    try {
      const archivo = await this.afipFileRepository.findOne({ where: { id } });

      if (!archivo) {
        throw new NotFoundException(`Archivo ${id} no encontrado`);
      }

      archivo.activo = false;
      await this.afipFileRepository.save(archivo);
      this.logger.log(`Archivo ${id} desactivado`);
    } catch (error) {
      this.logger.error(`Error desactivando archivo ${id}`, error);
      throw error;
    }
  }
}
