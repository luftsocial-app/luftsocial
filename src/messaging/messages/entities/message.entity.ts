import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import {
  MessageType,
  MessageStatus,
} from '../../shared/enums/message-type.enum';
import { ConversationEntity } from '../../conversations/entities/conversation.entity';
import { User } from '../../../entities/users/user.entity';
import { AttachmentEntity } from './attachment.entity';
import { MessageReactionDto } from '../dto/message-response.dto';
import { CommonEntity } from '../../shared/entities/common.entity';

@Entity('messages')
@Index('idx_msg_search', ['conversationId', 'createdAt'], { unique: false })
@Index('idx_msg_tenant_created', ['tenantId', 'createdAt'], { unique: false })
@Index('idx_msg_created_at', ['createdAt'], { unique: false })
@Index('idx_msg_tenant', ['tenantId'], { unique: false })
@Index('idx_msg_deleted_at', ['deletedAt'], { unique: false })
export class MessageEntity extends CommonEntity {
  @Column('text')
  content: string;

  @ManyToOne(() => ConversationEntity, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @Column({ name: 'conversation_id' })
  @Index('idx_msg_conversation', { unique: false })
  conversationId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  @Index('idx_msg_sender', { unique: false })
  senderId: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @Index('idx_msg_type', { unique: false })
  type: MessageType;

  @OneToMany(() => AttachmentEntity, (attachment) => attachment.message, {
    cascade: true,
    eager: true,
  })
  attachments: AttachmentEntity[];

  @Column({ name: 'is_edited', default: false })
  isEdited: boolean;

  @Column({ name: 'is_deleted', default: false })
  @Index('idx_msg_deleted', { unique: false })
  isDeleted: boolean;

  @Column({ name: 'is_pinned', default: false })
  @Index('idx_msg_pinned', { unique: false })
  isPinned: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENDING,
  })
  @Index('idx_msg_status', { unique: false })
  status: MessageStatus;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy: string;

  @ManyToOne(() => MessageEntity, { nullable: true })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage?: MessageEntity; // For threads

  @Column({ name: 'parent_message_id', nullable: true })
  @Index('idx_msg_parent', { unique: false })
  parentMessageId?: string;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata: {
    reactions?: { [userId: string]: string };
    editHistory?: Array<{
      content: string;
      editedAt: Date;
    }>;
    mentionedUserIds?: string[];
  };

  @Column({ type: 'jsonb', default: [] })
  reactions: MessageReactionDto[];

  @Column({ type: 'jsonb', default: [], name: 'edit_history' })
  editHistory: string[];

  @Column({ type: 'jsonb', default: {}, name: 'read_by' })
  readBy: { [userId: string]: Date };

  // Helper methods
  markAsRead(userId: string): void {
    this.readBy[userId] = new Date();
  }

  isReadBy(userId: string): boolean {
    return !!this.readBy[userId];
  }

  getReadCount(): number {
    return Object.keys(this.readBy).length;
  }

  addEditHistory(content: string): void {
    if (!this.editHistory) this.editHistory = [];
    this.editHistory.push(content);
  }

  addReaction(userId: string, emoji: string): void {
    if (!this.reactions) this.reactions = [];

    const existingIndex = this.reactions.findIndex(
      (r) => r.userId === userId && r.emoji === emoji,
    );

    if (existingIndex === -1) {
      this.reactions.push({
        userId,
        emoji,
        createdAt: new Date(),
      });
    }
  }

  removeReaction(userId: string, emoji?: string): void {
    if (!this.reactions) return;

    if (emoji) {
      this.reactions = this.reactions.filter(
        (r) => !(r.userId === userId && r.emoji === emoji),
      );
    } else {
      this.reactions = this.reactions.filter((r) => r.userId !== userId);
    }
  }

  getReactionCount(): number {
    return this.reactions.length;
  }
}
