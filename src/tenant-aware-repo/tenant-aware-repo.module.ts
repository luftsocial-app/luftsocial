// import { Module } from '@nestjs/common';
// import { TenantService } from './tenant.service';

// @Module({
//   providers: [TenantService],
//   exports: [TenantService],
// })
// export class DatabaseModule {}

import { DynamicModule, Module, Provider, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import e, { Request } from 'express';
import { DataSource, EntityTarget } from 'typeorm';
import { TenantAwareRepository } from './tenant-aware.repos';

@Module({})
export class TenantAwareRepoModule {
  static forFeature(entities: EntityTarget<any>[]): DynamicModule {
    const providers: Provider[] = entities.map((entity: any) => ({
      provide: `TENANT_AWARE_REPOSITORY_${entity.name}`,
      scope: Scope.REQUEST, // Ensure it is request-scoped
      useFactory: (req: Request, dataSource: DataSource) => {
        const tenantId: string = req['tenantId']; // Extract tenantId from the request

        return new TenantAwareRepository(entity, dataSource, tenantId);
      },
      inject: [REQUEST, DataSource], // Inject the request object and DataSource
    }));

    return {
      module: TenantAwareRepoModule,
      providers: providers,
      exports: providers, // Export the providers so they can be used in other modules
    };
  }
}
