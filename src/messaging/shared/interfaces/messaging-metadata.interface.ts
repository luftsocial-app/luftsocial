export interface MessageEditRecord {
  content: string;
  editedAt: Date;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface MessageMetadata {
  editHistory?: MessageEditRecord[];
  reactions?: { [emoji: string]: MessageReaction };
  mentionedUserIds?: string[];
  linkPreviews?: {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
  }[];
}
