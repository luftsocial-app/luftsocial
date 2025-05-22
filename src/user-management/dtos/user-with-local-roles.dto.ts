import { User as ClerkUser } from '@clerk/backend';
import { Role } from '../entities/role.entity';

export interface UserWithLocalRoles extends ClerkUser {
  localRoles?: Role[];
}
