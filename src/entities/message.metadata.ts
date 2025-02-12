import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class MessageMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  fileName?: string;

  @Column({ nullable: true })
  fileSize?: number;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ type: 'jsonb', nullable: true })
  dimensions?: {
    width: number;
    height: number;
  };

  @Column({ nullable: true })
  duration?: number;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({ nullable: true })
  caption?: string;

  @Column({ nullable: true })
  encryptionKey?: string;

  @Column({ nullable: true })
  forwardedFrom?: string;

  @Column({ type: 'jsonb', nullable: true })
  location?: {
    latitude: number;
    longitude: number;
  };

  @OneToOne(() => Message, (message) => message.metadata)
  message: Message;
}
