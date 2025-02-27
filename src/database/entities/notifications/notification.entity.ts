import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Message } from '../chats/message.entity';
import { User } from '../users/user.entity';

@Entity('tbl_notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Message, { nullable: true })
  message?: Message;

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
