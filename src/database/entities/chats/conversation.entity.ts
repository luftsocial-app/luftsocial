import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  UpdateDateColumn,
} from 'typeorm';
import { IConversationSettings } from '../../../common/interface/message.interface';
import { Message } from './message.entity';
import { User } from '../users/user.entity';

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

@Entity('conversations')
export class Conversation {
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

  @ManyToMany(() => User, (user) => user.conversations)
  @JoinTable({
    name: 'conversation_participants',
    joinColumn: { name: 'conversation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  participants: User[];

  @ManyToMany(() => User, (user) => user.adminOf)
  @JoinTable({
    name: 'conversation_admins',
    joinColumn: { name: 'conversation_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  admins: User[];

  @OneToMany(() => Message, (message) => message.conversation, {
    cascade: true,
  })
  messages: Message[];

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
