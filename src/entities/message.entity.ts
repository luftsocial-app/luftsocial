import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { MessageType, MessageStatus } from '../common/enums/messaging';
import { MessageMetadata } from './message.metadata';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  conversationId: string;

  @Column('uuid')
  senderId: string;

  @Column()
  content: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: 'uuid', array: true, default: [] })
  readBy: string[];

  @Column({ type: 'uuid', array: true, default: [] })
  deliveredTo: string[];

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENDING,
  })
  status: MessageStatus;

  @Column({ nullable: true })
  replyToId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ nullable: true })
  deletedBy?: string;

  @OneToOne(() => MessageMetadata, (metadata) => metadata.message, {
    cascade: true,
  })
  metadata: MessageMetadata;
}
