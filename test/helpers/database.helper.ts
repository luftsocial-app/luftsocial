import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export class DatabaseHelper {
  private static dataSource: DataSource;
  private static container: StartedPostgreSqlContainer;

  static async startContainer() {
    this.container = await new PostgreSqlContainer()
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    return this.container;
  }

  static async stopContainer() {
    if (this.container) {
      await this.container.stop();
    }
  }

  static getTestDatabaseConfig() {
    return TypeOrmModule.forRoot({
      type: 'postgres',
      host: this.container.getHost(),
      port: this.container.getPort(),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
      entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    });
  }

  static async initializeDataSource(dataSource: DataSource) {
    this.dataSource = dataSource;
    await this.cleanDatabase();
  }

  static async cleanDatabase() {
    if (!this.dataSource) return;

    const entities = this.dataSource.entityMetadatas;
    const tableNames = entities
      .map((entity) => `"${entity.tableName}"`)
      .join(', ');

    await this.dataSource.query(`TRUNCATE ${tableNames} CASCADE;`);
  }

  static getRepository<T>(entity: any): Repository<T> {
    return this.dataSource.getRepository(entity);
  }
}
