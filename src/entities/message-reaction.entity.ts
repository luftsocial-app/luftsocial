import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  messageId: string;

  @Column('uuid')
  userId: string;

  @Column()
  emoji: string;
}
