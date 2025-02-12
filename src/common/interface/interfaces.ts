import { UserRole, GroupRole, Permission } from '../enums/roles';

export interface IBaseEntity {
  id: string | number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IUserPermissions {
  appPermissions: Permission[];
  groupPermissions: Map<string, Permission[]>;
}

export interface IUserRoles {
  UserRoles: UserRole[];
  groupRole: GroupRole[];
}

export interface ITenantEntity extends IBaseEntity {
  organizationId: string;
}

export interface IUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
}

export interface IMessageMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  thumbnailUrl?: string;
  caption?: string;
  encryptionKey?: string;
  forwardedFrom?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface IConversationSettings {
  muted: boolean;
  pinned: boolean;
  theme?: string;
  notifications: boolean;
  archiveOnExit?: boolean;
  messageExpiry?: number; // Time-to-live for messages (in seconds)
  encryptionEnabled?: boolean;
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
