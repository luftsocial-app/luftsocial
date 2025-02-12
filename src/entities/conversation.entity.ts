import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { IConversationSettings } from '../common/interface/interfaces';

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;
  @Column({
    type: 'enum',
    enum: ['direct', 'group'],
  })
  type: 'direct' | 'group';

  @Column({ type: 'uuid', array: true })
  participantIds: string[];

  @Column({ type: 'jsonb', default: {} })
  metadata: {
    name?: string;
    avatar?: string;
    isEncrypted?: boolean;
  };

  @Column({ type: 'jsonb', default: {} })
  settings: IConversationSettings;
}
