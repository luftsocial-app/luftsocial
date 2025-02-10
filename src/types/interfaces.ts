import { Role } from '../entities/role.entity';

export interface IBaseEntity {
  id: string | number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITenantEntity extends IBaseEntity {
  organizationId: string;
}

export interface IUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: Role[];
}
