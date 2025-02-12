import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { GroupRole } from '../common/enums/messaging';

@Entity()
export class ConversationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('uuid')
  conversationId: string;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: GroupRole,
    default: GroupRole.MEMBER,
  })
  role: GroupRole;

  @Column({ type: 'jsonb', default: {} })
  settings: {
    muted: boolean;
    pinned: boolean;
  };
}
