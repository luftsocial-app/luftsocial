import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private tenantId: string;

  setTenantId(id: string) {
    this.tenantId = id;
  }

  getTenantId(): string {
    console.log({ tenantId: this.tenantId });

    return this.tenantId;
  }
}
