import { DataSource } from 'typeorm';
import * as config from 'config';

export default new DataSource({
  type: 'postgres',
  host: config.get('DB_HOST') || 'localhost',
  port: parseInt(config.get('DB_PORT')) || 5434,
  username: config.get('DB_USER') || 'root',
  password: config.get('DB_PASS') || 'admin',
  database: config.get('DB_NAME') || 'luftsocial',
  synchronize: true,
  entities: ['dist/**/**.entity{.ts,.js}'],

  migrations: ['src/database/migrations/luftsocialDB/*.ts'],
  migrationsTableName: 'migrations_history',
});
