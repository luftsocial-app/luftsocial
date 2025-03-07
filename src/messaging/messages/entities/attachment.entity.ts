import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MessageEntity } from './message.entity';
import { CommonEntity } from '../../shared/entities/common.entity';
export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other',
}

@Entity('message_attachments')
@Index('idx_att_tenant_created', ['tenantId', 'createdAt'], { unique: false })
@Index('idx_att_created_at', ['createdAt'], { unique: false })
@Index('idx_att_tenant', ['tenantId'], { unique: false })
@Index('idx_att_deleted_at', ['deletedAt'], { unique: false })
export class AttachmentEntity extends CommonEntity {
  @ManyToOne(() => MessageEntity, (message) => message.attachments)
  @JoinColumn({ name: 'message_id' })
  message: MessageEntity;

  @Column({ name: 'message_id' })
  @Index('idx_att_message', { unique: false })
  messageId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  @Index('idx_att_mime_type', { unique: false })
  mimeType: string;

  @Column({
    type: 'enum',
    enum: AttachmentType,
    default: AttachmentType.OTHER,
  })
  @Index('idx_att_type', { unique: false })
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

  @Column()
  url: string;

  @Column()
  @Index('idx_att_processing', { unique: false })
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
