import { DataSource } from 'typeorm';
import * as config from 'config';

console.log([
  config.get('DB_HOST'),
  config.get('DB_PORT'),
  config.get('DB_USER'),
  config.get('DB_PASS'),
  config.get('DB_NAME'),
]);

export default new DataSource({
  type: 'postgres',
  host: config.get('DB_HOST') || 'localhost',
  port: config.get('DB_PORT') || 5434,
  username: config.get('DB_USER') || 'root',
  password: config.get('DB_PASS') || 'admin',
  database: config.get('DB_NAME') || 'luftsocial',
  synchronize: false,
  entities: ['dist/**/**.entity{.ts,.js}'],

  migrations: ['src/database/migrations/luftsocialDB/*.ts'],
  migrationsTableName: 'migrations_history',
});
