import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAfipSettings1748000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO app_settings (id, value, description, data_type)
      VALUES
        ('AFIP_WSAA_URL',
         'https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl',
         'URL del servicio WSAA de AFIP (LoginCms WSDL)',
         'string'),
        ('AFIP_WSCERT_WSDL',
         'https://wsaa.afip.gov.ar/controladores-fiscales-ws/CertificadosService/CertificadosBean?wsdl',
         'WSDL del servicio WSCERT de AFIP (CertificadosService)',
         'string'),
        ('AFIP_CUIT',
         '',
         'CUIT del titular del certificado AFIP — editar desde panel de configuración',
         'string'),
        ('AFIP_FABRICANTE',
         'SE',
         'Código de fabricante para AFIP',
         'string'),
        ('USAR_BD_PARA_CERTIFICADO',
         'true',
         'Leer certificado PFX desde base de datos (recomendado en producción)',
         'boolean')
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM app_settings
      WHERE id IN (
        'AFIP_WSAA_URL',
        'AFIP_WSCERT_WSDL',
        'AFIP_CUIT',
        'AFIP_FABRICANTE',
        'USAR_BD_PARA_CERTIFICADO'
      );
    `);
  }
}
