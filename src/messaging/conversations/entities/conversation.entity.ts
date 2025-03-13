import { Entity, Column, OneToMany, Index } from 'typeorm';
import { MessageEntity } from '../../messages/entities/message.entity';
import { ParticipantEntity } from './participant.entity';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { IConversationSettings } from '../../shared/interfaces/conversation-settings.interface';
import { CommonEntity } from '../../shared/entities/common.entity';

@Entity('conversations')
@Index('idx_conv_tenant_created', ['tenantId', 'createdAt'], { unique: false })
@Index('idx_conv_created_at', ['createdAt'], { unique: false })
@Index('idx_conv_tenant', ['tenantId'], { unique: false })
@Index('idx_conv_deleted_at', ['deletedAt'], { unique: false })
export class ConversationEntity extends CommonEntity {
  @Column({ nullable: true })
  @Index('idx_conv_name', { unique: false })
  name?: string;

  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  @Index('idx_conv_type', { unique: false })
  type: ConversationType;

  @OneToMany(
    () => ParticipantEntity,
    (participant) => participant.conversation,
    {
      cascade: true,
    },
  )
  participants: ParticipantEntity[];

  @OneToMany(() => MessageEntity, (message) => message.conversation, {
    cascade: true,
  })
  messages: MessageEntity[];

  @Column({ name: 'tenant_id' })
  @Index('idx_conversation_tenant', { unique: false })
  tenantId: string;

  @Column({ name: 'is_private', default: false })
  @Index('idx_conv_privacy', { unique: false })
  isPrivate: boolean;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata: {
    avatar?: string;
    isEncrypted?: boolean;
  };

  @Column({
    name: 'last_message_at',
    nullable: true,
    type: 'timestamp with time zone',
  })
  @Index('idx_conv_last_message', { unique: false })
  lastMessageAt: Date;

  @Column({ name: 'settings', type: 'jsonb', default: {} })
  settings: IConversationSettings;

  @Column({ type: 'jsonb', default: {} })
  @Index('idx_conv_last_read_message_ids', { unique: false })
  lastReadMessageIds: {
    [userId: string]: {
      messageId: string;
      timestamp: Date;
    };
  };

  @Column({ type: 'jsonb', default: {} })
  @Index('idx_conv_unread_counts', { unique: false })
  unreadCounts: {
    [userId: string]: number;
  };
}
