import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from './user.entity';

@Entity('tbl_message_read')
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message)
  message: Message;

  @ManyToOne(() => User)
  user: User;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;
}
