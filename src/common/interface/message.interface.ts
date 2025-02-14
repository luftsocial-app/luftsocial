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
  messageExpiry?: number;
  encryptionEnabled?: boolean;
  allowReactions?: boolean;
  allowThreads?: boolean;
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
