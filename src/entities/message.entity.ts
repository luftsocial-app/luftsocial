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
} from '../common/enums/messaging';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

@Entity('tbl_messages')
export class Message {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column()
  conversation_id?: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column()
  senderId?: string

  @Column({ name: 'content' })
  content: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

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

  @ManyToOne(() => Group, group => group.messages, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column({ nullable: true })
  groupId?: string;

  @ManyToOne(() => User, user => user.receivedMessages)
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @Column()
  receiverId?: string;

  @Column()
  sentAt?: Date;

  // @Column({ type: 'boolean', default: false })
  // isRead: boolean;
}