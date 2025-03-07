import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { User } from '../../../entities/users/user.entity';
import { ParticipantRole } from '../../shared/enums/participant-role.enum';

@Entity('conversation_participants')
export class ParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => ConversationEntity,
    (conversation) => conversation.participants,
  )
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.MEMBER,
  })
  role: ParticipantRole;

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
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'jsonb', default: {} })
  settings: {
    muted: boolean;
    pinned: boolean;
    notificationsEnabled: boolean;
  };

  // Helper method to check if the participant is an admin or owner
  isAdmin(): boolean {
    return (
      this.role === ParticipantRole.ADMIN || this.role === ParticipantRole.OWNER
    );
  }
}
