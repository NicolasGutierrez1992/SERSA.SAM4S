import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 's3rs4'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME', 'db_sersa'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: configService.get('NODE_ENV') === 'development', // En producción false
  logging: configService.get('NODE_ENV') === 'development',
  ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
});

export default registerAs('database', () => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 's3rs4',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'db_sersa',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}));

// TODO: Descomentar cuando se instale TypeORM
// export default registerAs('database', () => ({
//   type: 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT, 10) || 5432,
//   username: process.env.DB_USERNAME || 's3rs4',
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME || 'db_sersa',
//   entities: [__dirname + '/../**/*.entity{.ts,.js}'],
//   synchronize: process.env.NODE_ENV === 'development',
//   logging: process.env.NODE_ENV === 'development',
//   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
// }));