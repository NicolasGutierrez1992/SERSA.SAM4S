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

describe('Auditoria (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let auditoriaRepository: Repository<Auditoria>;

  const ADMIN_CUIT = '99999999902';
  const DISTRIBUIDOR_CUIT = '99999999903';
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
        nombre: 'E2E Test Admin (auditoria)',
        cuit: ADMIN_CUIT,
        mail: 'e2e-test-audit-admin@example.com',
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
        nombre: 'E2E Test Distribuidor',
        cuit: DISTRIBUIDOR_CUIT,
        mail: 'e2e-test-audit-distri@example.com',
        password: hashed,
        rol: 3,
        status: 1,
        must_change_password: false,
        limite_descargas: 5,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
    distribuidorId = distribuidor.id_usuario;

    // Un par de eventos de auditoría propios para tener algo que paginar/filtrar
    await auditoriaRepository.save([
      auditoriaRepository.create({ actor_id: adminId, accion: 'LOGIN' as any, objetivo_tipo: 'USER' as any, objetivo_id: String(adminId) }),
      auditoriaRepository.create({ actor_id: adminId, accion: 'LOGOUT' as any, objetivo_tipo: 'USER' as any, objetivo_id: String(adminId) }),
    ]);
  });

  afterAll(async () => {
    // Cada login() de los tests audita el intento — limpiar antes de borrar los
    // usuarios, por la FK auditoria.actor_id -> users.id_usuario.
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

  it('GET /api/auditoria — rol Distribuidor (no admin/facturación) recibe 403', async () => {
    const { access_token } = await login(DISTRIBUIDOR_CUIT);

    await request(app.getHttpServer())
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(403);
  });

  it('GET /api/auditoria — Admin puede listar y pagina correctamente', async () => {
    const { access_token } = await login(ADMIN_CUIT);

    const res = await request(app.getHttpServer())
      .get('/api/auditoria')
      .query({ page: 1, limit: 1, actor_id: adminId })
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
  });

  it('GET /api/auditoria — el actor devuelto nunca incluye el hash de password', async () => {
    const { access_token } = await login(ADMIN_CUIT);

    const res = await request(app.getHttpServer())
      .get('/api/auditoria')
      .query({ actor_id: adminId, limit: 5 })
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200);

    for (const log of res.body.data) {
      if (log.actor) {
        expect(log.actor.password).toBeUndefined();
      }
    }
  });
});
