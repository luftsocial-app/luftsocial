import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { IConversationSettings } from '../../common/interface/message.interface';
import { Message } from './message.entity';
import { ChatParticipants } from './chat-participants.entity';

@Entity('tbl_conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column()
  senderId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'name', unique: true })
  name: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['direct', 'group', 'channel'],
  })
  type: 'direct' | 'group' | 'channel';

  @Column({ name: 'is_private', type: 'boolean', default: false })
  isPrivate: boolean; // Only invited users can join if true

  @OneToMany(
    () => ChatParticipants,
    (chatParticipants) => chatParticipants.conversation,
  )
  @JoinColumn({ name: 'participant_ids' })
  participantIds: ChatParticipants[];

  @OneToMany(() => Message, (message) => message.conversationId)
  @JoinColumn({ name: 'message_id' })
  messages: Message[];

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata: {
    name?: string;
    avatar?: string;
    isEncrypted?: boolean;
  };

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'settings', type: 'jsonb', default: {} })
  settings: IConversationSettings;
}
