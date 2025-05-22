import { User as ClerkUserType } from '@clerk/backend';
import { Role } from '../entities/role.entity';
import { Tenant } from '../entities/tenant.entity';

export interface ClerkUserWithLocalRelations extends ClerkUserType {
  localRoles?: Role[];
  localTenants?: Tenant[];
}
