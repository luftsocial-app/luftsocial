import { Permission, UserRole, GroupRole } from '../enums/roles';

export interface IUserPermissions {
  appPermissions: Permission[];
  groupPermissions: Map<string, Permission[]>;
}

export interface IUserRoles {
  UserRoles: UserRole[];
  groupRole: GroupRole[];
}

export interface IUserData {
  email: string;
  clerkId?: string;
  firstName?: string;
  TenantId: string;
  lastName?: string;
  role?: UserRole;
  permissions?: Permission[];
}

export interface IGroupSettings {
  allowMemberInvites: boolean;
  allowMemberMessages: boolean;
  onlyAdminsCanPin: boolean;
  onlyAdminsCanDelete: boolean;
  approvalRequired?: boolean;
  maxMembers?: number;
  description?: string;
}
