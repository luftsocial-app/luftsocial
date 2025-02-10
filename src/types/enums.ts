import { Request } from 'express';

export interface TenantAwareRequest extends Request {
  tenantId: string;
}

export enum GroupRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum ResponseStatus {
  SUCCESS = 1,
  GROUP_NOT_FOUND = 2,
  NOT_ADMIN = 3,
  ALREADY_MEMBER = 4,
  USER_NOT_FOUND = 5,
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
}

export enum Permission {
  MANAGE_USERS = 'manage_users',
  MANAGE_GROUPS = 'manage_groups',
  MANAGE_MESSAGES = 'manage_messages',
  INVITE_MEMBERS = 'invite_members',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  FILE = 'file',
  LINK = 'link',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}
