import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST') || 'localhost',
  port: configService.get('DB_PORT') || 5434,
  username: configService.get('DB_USER') || 'root',
  password: configService.get('DB_PASS') || 'admin',
  database: configService.get('DB_NAME') || 'luftsocial',
  synchronize: false,
  entities: ['dist/**/**.entity{.ts,.js}'],

  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations_history',
});
