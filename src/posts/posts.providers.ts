import { DataSource } from 'typeorm';
import { Post } from './post.entity';
import { createTenantAwareRepository } from '../database/tenant-aware.repository';

export const postProviders = [
  {
    provide: 'POST_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      createTenantAwareRepository(Post, dataSource),
    inject: ['DATA_SOURCE'],
  },
];
