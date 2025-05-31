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

export enum AttachmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('message_attachments')
@Index('idx_att_tenant_created', ['tenantId', 'createdAt'], { unique: false })
@Index('idx_att_created_at', ['createdAt'], { unique: false })
@Index('idx_att_tenant', ['tenantId'], { unique: false })
@Index('idx_att_deleted_at', ['deletedAt'], { unique: false })
export class AttachmentEntity extends CommonEntity {
  @ManyToOne(() => MessageEntity, (message) => message.attachments, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message: MessageEntity;

  @Column({ name: 'message_id', nullable: true })
  @Index('idx_att_message', { unique: false })
  messageId: string;

  @Column({ name: 'conversation_id' })
  @Index('idx_att_conversation', { unique: false })
  conversationId: string;

  @Column({ name: 'upload_session_id', nullable: true })
  uploadSessionId: string;

  @Column()
  userId: string;

  @Column({ name: 'file_name' })
  @Index('idx_att_file_name', { unique: false })
  fileName: string;

  @Column({ name: 'file_size', nullable: true })
  fileSize: number;

  @Column({ name: 'file_key', nullable: true })
  fileKey: string;

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

  @Column({
    type: 'enum',
    enum: AttachmentStatus,
    default: AttachmentStatus.PENDING,
  })
  @Index('idx_att_status')
  status: AttachmentStatus;

  @Column({ name: 'url', nullable: true })
  url: string;

  @Column({ name: 'public_url', nullable: true })
  publicUrl?: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl?: string;

  @Column({ name: 'upload_verified', default: false })
  uploadVerified: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: {
    // Media properties
    width?: number;
    height?: number;
    duration?: number;

    // Original file info
    originalName: string;
  };

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
