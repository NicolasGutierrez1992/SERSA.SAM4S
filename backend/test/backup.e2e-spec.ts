import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Auditoria } from '../src/auditoria/entities/auditoria.entity';

/**
 * Solo verifica el control de acceso de las rutas — no dispara un backup real
 * (necesitaría pg_dump + credenciales reales de Google, fuera de alcance de
 * un test automatizado en CI). El flujo completo (dump, subida a Drive,
 * retención, mail de fallo) se valida manualmente en Docker con credenciales
 * reales antes de cada release que toque esta feature.
 */
describe('Backup (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let auditoriaRepository: Repository<Auditoria>;

  const ADMIN_CUIT = '99999999905';
  const DISTRIBUIDOR_CUIT = '99999999906';
  const PASSWORD = 'TestPassword123!';
  let adminId: number;
  let distribuidorId: number;

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
    auditoriaRepository = moduleFixture.get(getRepositoryToken(Auditoria));

    const hashed = await bcrypt.hash(PASSWORD, 12);
    const admin = await userRepository.save(
      userRepository.create({
        nombre: 'E2E Test Admin (backup)',
        cuit: ADMIN_CUIT,
        mail: 'e2e-test-backup-admin@example.com',
        password: hashed,
        rol: 1,
        status: 1,
        must_change_password: false,
        limite_descargas: 0,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
    adminId = admin.id_usuario;

    const distribuidor = await userRepository.save(
      userRepository.create({
        nombre: 'E2E Test Distribuidor (backup)',
        cuit: DISTRIBUIDOR_CUIT,
        mail: 'e2e-test-backup-distri@example.com',
        password: hashed,
        rol: 3,
        status: 1,
        must_change_password: false,
        limite_descargas: 5,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
    distribuidorId = distribuidor.id_usuario;
  });

  afterAll(async () => {
    await auditoriaRepository.delete({ actor_id: adminId });
    await auditoriaRepository.delete({ actor_id: distribuidorId });
    await userRepository.delete({ id_usuario: adminId });
    await userRepository.delete({ id_usuario: distribuidorId });
    await app.close();
  });

  async function login(cuit: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cuit, password: PASSWORD });
    return res.body as { access_token: string; csrfToken: string };
  }

  it('GET /api/backup/status — sin token devuelve 401', () => {
    return request(app.getHttpServer()).get('/api/backup/status').expect(401);
  });

  it('GET /api/backup/status — rol Distribuidor (no admin) recibe 403', async () => {
    const { access_token } = await login(DISTRIBUIDOR_CUIT);

    await request(app.getHttpServer())
      .get('/api/backup/status')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(403);
  });

  it('GET /api/backup/status — Admin puede consultar el historial', async () => {
    const { access_token } = await login(ADMIN_CUIT);

    const res = await request(app.getHttpServer())
      .get('/api/backup/status')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/backup/run — rol Distribuidor (no admin) recibe 403', async () => {
    const { access_token, csrfToken } = await login(DISTRIBUIDOR_CUIT);

    await request(app.getHttpServer())
      .post('/api/backup/run')
      .set('Authorization', `Bearer ${access_token}`)
      .set('X-CSRF-Token', csrfToken)
      .expect(403);
  });

  it('POST /api/backup/run — Admin sin header CSRF recibe 403 (protección global, no específica de backup)', async () => {
    const { access_token } = await login(ADMIN_CUIT);

    await request(app.getHttpServer())
      .post('/api/backup/run')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(403);
  });
});
