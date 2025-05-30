import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { MessageEntity } from './message.entity';
import { CommonEntity } from '../../shared/entities/common.entity';

@Entity('message_inboxes')
@Index('idx_msg_inbox_search', ['conversationId', 'createdAt'], { unique: false })
@Index('idx_msg_inbox_tenant_created', ['tenantId', 'createdAt'], { unique: false })
@Index('idx_msg_inbox_created_at', ['createdAt'], { unique: false })
@Index('idx_msg_inbox_tenant', ['tenantId'], { unique: false })
@Index('idx_msg_inbox_deleted_at', ['deletedAt'], { unique: false })
@Index(['recipientId', 'messageId'], { unique: true })
export class MessageInboxEntity extends CommonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @ManyToOne(() => MessageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: MessageEntity;

  @Column({ name: 'message_id' })
  messageId: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ default: false })
  delivered: boolean;

  @Column({ name:'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ default: false })
  read: boolean;

  @Column({ name:'read_at', type: 'timestamp', nullable: true })
  readAt: Date;

}