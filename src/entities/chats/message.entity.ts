import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  MessageType,
  MessageStatus,
  Attachment,
} from '../../common/enums/messaging';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  conversation: Conversation;

  @Column()
  conversationId: string;

  @ManyToOne(() => User)
  sender: User;

  @Column()
  senderId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    name: 'type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ name: 'attachments', type: 'jsonb', nullable: true })
  attachments?: Attachment[];

  @Column({ name: 'is_edited', default: false })
  isEdited?: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted?: boolean;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned?: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENDING,
  })
  status: MessageStatus;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @Column({ name: 'deleted_by', nullable: true })
  deletedBy?: string;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage?: Message; // For threads

  /**
   * Message metadata containing reactions and edit history
   * @property reactions - Map of user IDs to emoji reactions (e.g. { "user1": "👍", "user2": "❤️" })
   * @property editHistory - Array of previous message versions with timestamps
   */
  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata?: {
    /** Map of user IDs to their emoji reactions */
    reactions?: { [userId: string]: string };
    /** Array tracking edit history with content and timestamps */
    editHistory?: Array<{
      /** Previous message content */
      content: string;
      /** When this version was edited */
      editedAt: Date;
    }>;
  };

  @Column({ type: 'jsonb', default: {} })
  readBy: {
    [userId: string]: Date; // userId -> readTimestamp mapping
  };

  // Helper methods
  markAsRead(userId: string) {
    this.readBy[userId] = new Date();
  }

  isReadBy(userId: string): boolean {
    return !!this.readBy[userId];
  }

  getReadCount(): number {
    return Object.keys(this.readBy).length;
  }

  /**
   * Adds an entry to the edit history of this message
   * @param oldContent - The previous content of the message before editing
   */
  addEditHistory(oldContent: string): void {
    if (!this.metadata) {
      this.metadata = {};
    }

    if (!this.metadata.editHistory) {
      this.metadata.editHistory = [];
    }

    this.metadata.editHistory.push({
      content: oldContent,
      editedAt: new Date(),
    });

    this.isEdited = true;
  }
}
