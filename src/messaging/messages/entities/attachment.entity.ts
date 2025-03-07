import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MessageEntity } from './message.entity';

export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other',
}

@Entity('message_attachments')
export class AttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MessageEntity, (message) => message.attachments)
  @JoinColumn({ name: 'message_id' })
  message: MessageEntity;

  @Column({ name: 'message_id' })
  messageId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({
    type: 'enum',
    enum: AttachmentType,
    default: AttachmentType.OTHER,
  })
  type: AttachmentType;

  @Column({ name: 'storage_path' })
  storagePath: string;

  @Column({ name: 'public_url', nullable: true })
  publicUrl?: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    pageCount?: number;
    isProcessed?: boolean;
  };

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  url: string;

  @Column()
  processingStatus: string;

  // Helper methods to check file type
  isImage(): boolean {
    return this.type === AttachmentType.IMAGE;
  }

  isVideo(): boolean {
    return this.type === AttachmentType.VIDEO;
  }

  isAudio(): boolean {
    return this.type === AttachmentType.AUDIO;
  }

  isDocument(): boolean {
    return this.type === AttachmentType.DOCUMENT;
  }
}
