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

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let auditoriaRepository: Repository<Auditoria>;

  const TEST_CUIT = '99999999901';
  const TEST_PASSWORD = 'TestPassword123!';
  let testUserId: number;

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

    const hashed = await bcrypt.hash(TEST_PASSWORD, 12);
    const saved = await userRepository.save(
      userRepository.create({
        nombre: 'E2E Test Admin',
        cuit: TEST_CUIT,
        mail: 'e2e-test-auth@example.com',
        password: hashed,
        rol: 1,
        status: 1,
        must_change_password: false,
        limite_descargas: 0,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
    testUserId = saved.id_usuario;
  });

  afterAll(async () => {
    await auditoriaRepository.delete({ actor_id: testUserId });
    await userRepository.delete({ id_usuario: testUserId });
    await app.close();
  });

  it('POST /api/auth/login — credenciales correctas devuelve access_token y csrfToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cuit: TEST_CUIT, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.access_token).toBeDefined();
    expect(res.body.csrfToken).toBeDefined();
    expect(res.body.user.cuit).toBe(TEST_CUIT);
    // El hash de password nunca debe viajar en la respuesta
    expect(res.body.user.password).toBeUndefined();
  });

  it('POST /api/auth/login — credenciales incorrectas devuelve 401 y queda auditado como LOGIN_FALLIDO', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cuit: TEST_CUIT, password: 'password-incorrecta' })
      .expect(401);

    const log = await auditoriaRepository
      .createQueryBuilder('a')
      .where('a.accion = :accion', { accion: 'LOGIN_FALLIDO' })
      .andWhere("a.despues->>'cuit' = :cuit", { cuit: TEST_CUIT })
      .orderBy('a.timestamp', 'DESC')
      .getOne();

    expect(log).toBeDefined();
  });

  it('GET /api/auditoria — sin token devuelve 401', () => {
    return request(app.getHttpServer()).get('/api/auditoria').expect(401);
  });

  it('request mutante autenticado sin header X-CSRF-Token devuelve 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cuit: TEST_CUIT, password: TEST_PASSWORD });

    await request(app.getHttpServer())
      .patch(`/api/users/${testUserId}`)
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ nombre: 'Intento sin CSRF' })
      .expect(403);
  });

  it('request mutante con el header X-CSRF-Token correcto pasa la protección CSRF', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cuit: TEST_CUIT, password: TEST_PASSWORD });

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${testUserId}`)
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .set('X-CSRF-Token', login.body.csrfToken)
      .send({ nombre: 'E2E Test Admin (editado)' });

    expect(res.status).not.toBe(403);
  });
});
