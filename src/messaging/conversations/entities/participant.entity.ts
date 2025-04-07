import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { User } from '../../../user-management/entities/user.entity';
import { ParticipantRole } from '../../shared/enums/participant-role.enum';
import { CommonEntity } from '../../shared/entities/common.entity';

@Entity('conversation_participants')
@Index('idx_part_user_conversation', ['userId', 'conversationId'], {
  unique: true,
})
@Index('idx_part_tenant_created', ['tenantId', 'createdAt'], { unique: false })
@Index('idx_part_created_at', ['createdAt'], { unique: false })
@Index('idx_part_tenant', ['tenantId'], { unique: false })
@Index('idx_part_deleted_at', ['deletedAt'], { unique: false })
export class ParticipantEntity extends CommonEntity {
  @ManyToOne(
    () => ConversationEntity,
    (conversation) => conversation.participants,
  )
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;

  @Column({ name: 'conversation_id' })
  @Index('idx_part_conversation', { unique: false })
  conversationId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index('idx_part_user', { unique: false })
  userId: string;

  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.MEMBER,
  })
  @Index('idx_part_role', { unique: false })
  role: ParticipantRole;

  @Column({
    type: 'enum',
    enum: ['pending', 'member', 'banned'],
    default: 'member',
  })
  @Index('idx_part_status', { unique: false })
  status: 'pending' | 'member' | 'banned';

  @Column({
    name: 'last_active_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  @Index('idx_part_last_active', { unique: false })
  lastActiveAt: Date;

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
