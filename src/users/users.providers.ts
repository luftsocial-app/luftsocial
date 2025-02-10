import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { createTenantAwareRepository } from '../database/tenant-aware.repository';

export const userProviders = [
  {
    provide: 'USER_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      createTenantAwareRepository(User, dataSource),
    inject: ['DATA_SOURCE'],
  },
];
