import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Descarga } from '../src/descargas/entities/descarga.entity';
import { Auditoria } from '../src/auditoria/entities/auditoria.entity';

describe('Descargas — validar-descarga / re-descarga (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let descargaRepository: Repository<Descarga>;
  let auditoriaRepository: Repository<Auditoria>;

  const CUIT = '99999999904';
  const PASSWORD = 'TestPassword123!';
  const ID_CERTIFICADO_YA_DESCARGADO = 'SESHIA-9999999901';
  const ID_CERTIFICADO_NUEVO_SERIE = '9999999902';
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    descargaRepository = moduleFixture.get(getRepositoryToken(Descarga));
    auditoriaRepository = moduleFixture.get(getRepositoryToken(Auditoria));

    const hashed = await bcrypt.hash(PASSWORD, 12);
    const user = await userRepository.save(
      userRepository.create({
        nombre: 'E2E Test Distribuidor (descargas)',
        cuit: CUIT,
        mail: 'e2e-test-descargas@example.com',
        password: hashed,
        rol: 3,
        status: 1,
        must_change_password: false,
        limite_descargas: 50,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
    userId = user.id_usuario;

    // Simula una descarga previa de este usuario para ese certificado exacto —
    // sin pasar por AFIP, igual que hace registrarDescarga() al guardar la fila.
    await descargaRepository.save(
      descargaRepository.create({
        id_usuario: userId,
        id_certificado: ID_CERTIFICADO_YA_DESCARGADO,
        certificado_nombre: `${ID_CERTIFICADO_YA_DESCARGADO}-test.pem`,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
  });

  afterAll(async () => {
    // El login (llamado varias veces en los tests) audita cada intento con
    // actor_id = userId — hay que limpiar esos registros antes de poder borrar
    // el usuario, por la FK auditoria.actor_id -> users.id_usuario.
    await auditoriaRepository.delete({ actor_id: userId });
    await descargaRepository.delete({ id_usuario: userId });
    await userRepository.delete({ id_usuario: userId });
    await app.close();
  });

  async function login() {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cuit: CUIT, password: PASSWORD });
    return res.body as { access_token: string };
  }

  it('validar-descarga sin datos de certificado no incluye yaDescargado', async () => {
    const { access_token } = await login();

    const res = await request(app.getHttpServer())
      .get('/api/certificados/validar-descarga')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    expect(res.body.canDownload).toBe(true);
    expect(res.body.yaDescargado).toBeUndefined();
  });

  it('validar-descarga con un certificado ya descargado por este usuario devuelve yaDescargado: true', async () => {
    const { access_token } = await login();

    const res = await request(app.getHttpServer())
      .get('/api/certificados/validar-descarga')
      .query({ marca: 'SH', modelo: 'IA', numeroSerie: '9999999901' })
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    expect(res.body.yaDescargado).toBe(true);
    expect(res.body.fechaUltimaDescarga).toBeDefined();
  });

  it('validar-descarga con un certificado nunca descargado por este usuario devuelve yaDescargado: false', async () => {
    const { access_token } = await login();

    const res = await request(app.getHttpServer())
      .get('/api/certificados/validar-descarga')
      .query({ marca: 'SH', modelo: 'IA', numeroSerie: ID_CERTIFICADO_NUEVO_SERIE })
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    expect(res.body.yaDescargado).toBe(false);
  });
});
