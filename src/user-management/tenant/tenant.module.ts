import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}

// import { Module, Scope } from '@nestjs/common';
// import { REQUEST } from '@nestjs/core';

// import { TenantService } from './tenant.service';

// const tenantFactoryFromRequest = {
//   provide: 'TENANT',
//   scope: Scope.REQUEST,
//   useFactory: (req) => {
//     const tenant: string = req.headers.host.split('.')[0];
//     return tenant;
//   },
//   inject: [REQUEST],
// };
// @Module({
//   providers: [TenantService, tenantFactoryFromRequest],
//   exports: ['TENANT'],
// })
// export class TenantModule {}
