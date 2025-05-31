import { DataSource } from 'typeorm';
import * as config from 'config';

export default new DataSource({
  type: 'postgres',
  host: config.get('db.options.host') || 'localhost',
  port: parseInt(config.get('db.options.port')) || 5434,
  username: config.get('db.options.username') || 'root',
  password: config.get('db.options.password') || 'admin',
  database: config.get('db.options.database') || 'luftsocial',
  synchronize: false,
  entities: ['dist/**/**.entity{.ts,.js}'],

  migrations: ['src/database/migrations/luftsocialDB/*.ts'],
  migrationsTableName: 'migrations_history',
});
