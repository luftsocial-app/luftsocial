import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5434,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'admin',
  database: process.env.DB_NAME || 'luftsocial',
  synchronize: false,
  entities: ['dist/**/**.entity{.ts,.js}'],

  migrations: ['src/database/migrations/luftsocialDB/*.ts'],
  migrationsTableName: 'migrations_history',
});
