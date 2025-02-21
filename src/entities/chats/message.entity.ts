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

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata?: {
    reactions?: { [userId: string]: string }; // { user1: '👍', user2: '❤️' }
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
}
