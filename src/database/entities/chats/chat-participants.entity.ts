import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GroupRole } from '../../../common/enums/roles';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

@Entity('tbl_chat_participants')
export class ChatParticipants {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: GroupRole,
    default: GroupRole.MEMBER,
  })
  role: GroupRole;

  @Column({
    type: 'enum',
    enum: ['pending', 'member', 'banned'],
    default: 'member',
  })
  status: 'pending' | 'member' | 'banned';

  @Column({
    name: 'last_active_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastActiveAt?: Date;

  @Column({ type: 'jsonb', default: {} })
  settings: {
    muted: boolean;
    pinned: boolean;
  };
}
