export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  EDITOR = 'editor',
  MEMBER = 'member',
}

export enum GroupRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

export enum Permission {
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  MANAGE_GROUPS = 'manage_groups',
  DELETE_MESSAGES = 'delete_messages',
  PIN_MESSAGES = 'pin_messages',
  INVITE_MEMBERS = 'invite_members',
}
