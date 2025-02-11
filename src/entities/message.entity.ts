import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity'; // Assuming you have a User entity
import { Group } from './group.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.sentMessages)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: number;

  @ManyToOne(() => User, (user) => user.receivedMessages)
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @Column()
  receiverId: number;

  @Column()
  content: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({
    type: 'enum',
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  })
  status: 'sent' | 'delivered' | 'read';

  @CreateDateColumn()
  sentAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @ManyToOne(() => Group, (group) => group.messages, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column({ nullable: true })
  groupId: number;

  @Column({
    type: 'enum',
    enum: ['text', 'image', 'video', 'link', 'mixed'],
    default: 'text',
  })
  type: 'text' | 'image' | 'video' | 'link' | 'mixed';

  @Column({ nullable: true })
  mediaUrl: string;
}
