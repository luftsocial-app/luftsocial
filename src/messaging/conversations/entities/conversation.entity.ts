import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { MessageEntity } from '../../messages/entities/message.entity';
import { ParticipantEntity } from './participant.entity';
import { ConversationType } from '../../shared/enums/conversation-type.enum';
import { IConversationSettings } from '../../shared/interfaces/conversation-settings.interface';

@Entity('conversations')
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name?: string;

  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  type: ConversationType;

  @OneToMany(() => ParticipantEntity, participant => participant.conversation, {
    cascade: true,
  })
  participants: ParticipantEntity[];

  @OneToMany(() => MessageEntity, message => message.conversation, {
    cascade: true,
  })
  messages: MessageEntity[];

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata: {
    avatar?: string;
    isEncrypted?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastMessageAt: Date;

  @Column({ name: 'settings', type: 'jsonb', default: {} })
  settings: IConversationSettings;

  @Column({ type: 'jsonb', default: {} })
  lastReadMessageIds: {
    [userId: string]: {
      messageId: string;
      timestamp: Date;
    };
  };

  @Column({ type: 'jsonb', default: {} })
  unreadCounts: {
    [userId: string]: number;
  };
} 