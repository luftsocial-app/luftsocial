import { DataSource, Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
// ...existing code...

export const repositoryProviders = [
  // ...existing code...
  {
    provide: 'ROLE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Role),
    inject: ['DATA_SOURCE'],
  },
  // ...existing code...
];
