import { MessageEntity } from '../../../messaging/messages/entities/message.entity';
import { User } from '../../../user-management/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('tbl_notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => MessageEntity, { nullable: true })
  message?: MessageEntity;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['mention', 'reaction', 'message'],
  })
  type: 'mention' | 'reaction' | 'message';

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
