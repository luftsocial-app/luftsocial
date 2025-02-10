import { DataSource } from 'typeorm';
import { createTenantAwareRepository } from './tenant-aware.repository';
import { Scope } from '@nestjs/common';

export function createRepositoryProvider(entity: any, name: string) {
  return {
    provide: `${name}_REPOSITORY`,
    scope: Scope.REQUEST, // make the repository request-scoped
    useFactory: (dataSource: DataSource) =>
      createTenantAwareRepository(dataSource, entity), // Fixed parameter order
    inject: ['DATA_SOURCE'],
  };
}
