/**
 * Message event constants to prevent magic strings across the codebase
 */
export enum MessageEventType {
  // Client -> Server events
  SEND_MESSAGE = 'sendMessage',
  UPDATE_MESSAGE = 'updateMessage',
  DELETE_MESSAGE = 'deleteMessage',
  JOIN_CONVERSATION = 'joinConversation',
  LEAVE_CONVERSATION = 'leaveConversation',
  TYPING_START = 'typing',
  TYPING_STOP = 'stopTyping',
  MARK_AS_READ = 'markAsRead',
  ADD_REACTION = 'addReaction',
  REMOVE_REACTION = 'removeReaction',
  PARTICIPANT_ADD = 'addParticipant',
  PARTICIPANT_REMOVE = 'removeParticipant',
  
  // Server -> Client events
  MESSAGE_CREATED = 'messageCreated',
  MESSAGE_UPDATED = 'messageUpdated',
  MESSAGE_DELETED = 'messageDeleted',
  USER_TYPING = 'userTyping',
  USER_STOPPED_TYPING = 'userStoppedTyping',
  MESSAGE_READ = 'messageRead',
  REACTION_ADDED = 'reactionAdded',
  REACTION_REMOVED = 'reactionRemoved',
  PARTICIPANTS_UPDATED = 'participantsUpdated',
  ERROR = 'error'
}

/**
 * Room naming utility for consistent room name generation
 */
export class RoomNameFactory {
  static userRoom(userId: string): string {
    return `user:${userId}`;
  }
  
  static conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }
}

// Event payload type definitions
export interface MessageEventPayload {
  conversationId: string;
  content: string;
  parentMessageId?: string;
  metadata?: Record<string, any>;
}

export interface MessageUpdatePayload {
  messageId: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface MessageDeletePayload {
  messageId: string;
  reason?: string;
}

export interface TypingEventPayload {
  conversationId: string;
}

export interface ReadReceiptPayload {
  messageId: string;
  conversationId: string;
}

export interface ReactionPayload {
  messageId: string;
  emoji: string;
}

export interface ParticipantActionPayload {
  conversationId: string;
  participantIds: string[];
}

// Response events
export interface MessageCreatedEvent {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  createdAt: Date;
  parentMessageId?: string;
  attachments?: any[];
}

export interface MessageUpdatedEvent {
  id: string;
  conversationId: string;
  content: string;
  updatedAt: Date;
  isEdited: boolean;
  editVersion: number;
}

export interface MessageDeletedEvent {
  id: string;
  conversationId: string;
  deletedBy: string;
  deletedAt: Date;
}

export interface TypingEvent {
  conversationId: string;
  user: {
    id: string;
    username: string;
  };
}

export interface ReadReceiptEvent {
  messageId: string;
  userId: string;
  conversationId: string;
  readAt: Date;
}

export interface ReactionEvent {
  messageId: string;
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface ParticipantUpdateEvent {
  conversationId: string;
  action: 'added' | 'removed' | 'updated';
  actorId: string;
  participants: {
    id: string;
    role?: string;
  }[];
  timestamp: Date;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: any;
} 