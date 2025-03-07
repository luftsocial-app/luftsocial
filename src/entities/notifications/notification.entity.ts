import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { MessageEntity } from '../../messaging/messages/entities/message.entity';

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
