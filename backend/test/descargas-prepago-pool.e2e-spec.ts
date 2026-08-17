import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Descarga } from '../src/descargas/entities/descarga.entity';
import { CompraPrepago } from '../src/users/entities/compra-prepago.entity';
import { DescargasService } from '../src/descargas/descargas.service';
import { EstadoDescarga } from '../src/shared/types';

/**
 * Cubre el consumo independiente de saldo prepago entre un Distribuidor y su
 * Mayorista (no-SERSA): cada lado (estadoDistribuidor / estadoMayorista) mira
 * únicamente su propio pool de compras_prepago, sin que uno dependa del otro.
 */
describe('DescargasService — pool prepago Distribuidor/Mayorista (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let descargaRepository: Repository<Descarga>;
  let compraRepository: Repository<CompraPrepago>;
  let descargasService: DescargasService;

  const ID_MAYORISTA = 987654321;
  let mayoristaUserId: number;
  let distribuidorUserId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    descargaRepository = moduleFixture.get(getRepositoryToken(Descarga));
    compraRepository = moduleFixture.get(getRepositoryToken(CompraPrepago));
    descargasService = moduleFixture.get(DescargasService);

    const mayorista = await userRepository.save(
      userRepository.create({
        nombre: 'E2E Test Mayorista (pool prepago)',
        cuit: '99999999910',
        mail: 'e2e-test-mayorista-pool@example.com',
        password: 'x',
        rol: 2,
        id_mayorista: ID_MAYORISTA,
        status: 1,
        must_change_password: false,
        limite_descargas: 0,
        tipo_descarga: 'PREPAGO',
      }),
    );
    mayoristaUserId = mayorista.id_usuario;

    const distribuidor = await userRepository.save(
      userRepository.create({
        nombre: 'E2E Test Distribuidor (pool prepago)',
        cuit: '99999999911',
        mail: 'e2e-test-distribuidor-pool@example.com',
        password: 'x',
        rol: 3,
        id_mayorista: ID_MAYORISTA,
        status: 1,
        must_change_password: false,
        limite_descargas: 2,
        tipo_descarga: 'CUENTA_CORRIENTE',
      }),
    );
    distribuidorUserId = distribuidor.id_usuario;
  });

  afterAll(async () => {
    await descargaRepository.delete({ id_usuario: distribuidorUserId });
    await descargaRepository.delete({ id_usuario: mayoristaUserId });
    await compraRepository.delete({ id_usuario: distribuidorUserId });
    await compraRepository.delete({ id_usuario: mayoristaUserId });
    await userRepository.delete({ id_usuario: distribuidorUserId });
    await userRepository.delete({ id_usuario: mayoristaUserId });
    await app.close();
  });

  afterEach(async () => {
    // Cada caso arranca en 0 (ni descargas previas ni saldo remanente)
    await descargaRepository.delete({ id_usuario: distribuidorUserId });
    await descargaRepository.delete({ id_usuario: mayoristaUserId });
    await compraRepository.delete({ id_usuario: distribuidorUserId });
    await compraRepository.delete({ id_usuario: mayoristaUserId });
  });

  async function saldoDe(idUsuario: number): Promise<number> {
    const compras = await compraRepository.find({
      where: { id_usuario: idUsuario },
    });
    return compras.reduce((acc, c) => acc + (c.cantidad - c.cantidad_usada), 0);
  }

  it('Caso 1 (ambos con prepago): ambos estados quedan PREPAGO y se descuenta cada pool por separado', async () => {
    await compraRepository.save(
      compraRepository.create({
        id_usuario: distribuidorUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );
    await compraRepository.save(
      compraRepository.create({
        id_usuario: mayoristaUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );

    const descarga = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO1',
      certificadoNombre: 'test-caso1.pem',
    });

    expect(descarga.estadoDistribuidor).toBe(EstadoDescarga.PREPAGO);
    expect(descarga.estadoMayorista).toBe(EstadoDescarga.PREPAGO);
    expect(await saldoDe(distribuidorUserId)).toBe(0);
    expect(await saldoDe(mayoristaUserId)).toBe(0);
  });

  it('Caso 2 (solo distribuidor con prepago propio): estadoDistribuidor=PREPAGO, estadoMayorista=Pendiente, solo se toca el pool del distribuidor', async () => {
    await compraRepository.save(
      compraRepository.create({
        id_usuario: distribuidorUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );

    const descarga = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO2',
      certificadoNombre: 'test-caso2.pem',
    });

    expect(descarga.estadoDistribuidor).toBe(EstadoDescarga.PREPAGO);
    expect(descarga.estadoMayorista).toBe(EstadoDescarga.PENDIENTE_FACTURAR);
    expect(await saldoDe(distribuidorUserId)).toBe(0);
  });

  it('Caso 3 (solo mayorista con prepago): estadoDistribuidor=Pendiente (cuenta corriente propia), estadoMayorista=PREPAGO, solo se toca el pool del mayorista', async () => {
    await compraRepository.save(
      compraRepository.create({
        id_usuario: mayoristaUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );

    const descarga = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO3',
      certificadoNombre: 'test-caso3.pem',
    });

    expect(descarga.estadoDistribuidor).toBe(EstadoDescarga.PENDIENTE_FACTURAR);
    expect(descarga.estadoMayorista).toBe(EstadoDescarga.PREPAGO);
    expect(await saldoDe(mayoristaUserId)).toBe(0);
  });

  it('Caso 4 (ninguno con prepago): ambos estados Pendiente, ningún pool tocado, bloqueado al superar el límite de cuenta corriente propio del distribuidor', async () => {
    // El fixture del distribuidor tiene limite_descargas=2
    const d1 = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO4A',
      certificadoNombre: 'test-caso4a.pem',
    });
    expect(d1.estadoDistribuidor).toBe(EstadoDescarga.PENDIENTE_FACTURAR);
    expect(d1.estadoMayorista).toBe(EstadoDescarga.PENDIENTE_FACTURAR);

    const d2 = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO4B',
      certificadoNombre: 'test-caso4b.pem',
    });
    expect(d2.estadoDistribuidor).toBe(EstadoDescarga.PENDIENTE_FACTURAR);

    await expect(
      descargasService.registrarDescarga({
        usuarioId: distribuidorUserId,
        controladorId: 'TEST-CERT-CASO4C',
        certificadoNombre: 'test-caso4c.pem',
      }),
    ).rejects.toThrow();
  });

  it('updateEstadoDescarga en Caso 3: el mayorista mueve estadoDistribuidor libremente, estadoMayorista queda inmutable salvo Garantía (que restaura el pool del mayorista)', async () => {
    await compraRepository.save(
      compraRepository.create({
        id_usuario: mayoristaUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );

    const descarga = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO3-UPD',
      certificadoNombre: 'test-caso3-upd.pem',
    });
    expect(descarga.estadoMayorista).toBe(EstadoDescarga.PREPAGO);

    const actualizado = await descargasService.updateEstadoDescarga(
      descarga.id,
      { estadoDistribuidor: EstadoDescarga.FACTURADO },
      mayoristaUserId,
      2,
      new Date(),
    );
    expect(actualizado.estadoDistribuidor).toBe(EstadoDescarga.FACTURADO);

    await expect(
      descargasService.updateEstadoDescarga(
        descarga.id,
        { estadoMayorista: EstadoDescarga.FACTURADO },
        mayoristaUserId,
        1,
        new Date(),
      ),
    ).rejects.toThrow();

    await descargasService.updateEstadoDescarga(
      descarga.id,
      { estadoMayorista: EstadoDescarga.GARANTIA },
      mayoristaUserId,
      1,
      new Date(),
    );
    expect(await saldoDe(mayoristaUserId)).toBe(1);
  });

  it('Restauración en Caso 1: pasar a Bonificado restaura ambos pools (distribuidor y mayorista) en 1 unidad cada uno', async () => {
    await compraRepository.save(
      compraRepository.create({
        id_usuario: distribuidorUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );
    await compraRepository.save(
      compraRepository.create({
        id_usuario: mayoristaUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );

    const descarga = await descargasService.registrarDescarga({
      usuarioId: distribuidorUserId,
      controladorId: 'TEST-CERT-CASO1-BON',
      certificadoNombre: 'test-caso1-bon.pem',
    });
    expect(await saldoDe(distribuidorUserId)).toBe(0);
    expect(await saldoDe(mayoristaUserId)).toBe(0);

    await descargasService.updateEstadoDescarga(
      descarga.id,
      { estadoMayorista: EstadoDescarga.BONIFICADO },
      mayoristaUserId,
      1,
      new Date(),
    );

    expect(await saldoDe(distribuidorUserId)).toBe(1);
    expect(await saldoDe(mayoristaUserId)).toBe(1);
  });

  it('Regresión: Mayorista descargando con su propio saldo sigue con ambos estados PREPAGO inmutables', async () => {
    await compraRepository.save(
      compraRepository.create({
        id_usuario: mayoristaUserId,
        cantidad: 1,
        cantidad_usada: 0,
      }),
    );

    const descarga = await descargasService.registrarDescarga({
      usuarioId: mayoristaUserId,
      controladorId: 'TEST-CERT-REGRESION',
      certificadoNombre: 'test-regresion.pem',
    });

    expect(descarga.estadoDistribuidor).toBe(EstadoDescarga.PREPAGO);
    expect(descarga.estadoMayorista).toBe(EstadoDescarga.PREPAGO);

    await expect(
      descargasService.updateEstadoDescarga(
        descarga.id,
        { estadoMayorista: EstadoDescarga.FACTURADO },
        mayoristaUserId,
        1,
        new Date(),
      ),
    ).rejects.toThrow();
  });
});
