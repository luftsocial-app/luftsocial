import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  private TenantId: string;

  setTenantId(id: string) {
    this.TenantId = id;
  }

  getTenantId(): string {
    console.log({ TenantId: this.TenantId });

    return this.TenantId;
  }
}
