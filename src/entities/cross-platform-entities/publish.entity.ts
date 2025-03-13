import { Column } from 'typeorm/decorator/columns/Column';
import { CreateDateColumn } from 'typeorm/decorator/columns/CreateDateColumn';
import { PrimaryGeneratedColumn } from 'typeorm/decorator/columns/PrimaryGeneratedColumn';
import { UpdateDateColumn } from 'typeorm/decorator/columns/UpdateDateColumn';
import { Entity } from 'typeorm/decorator/entity/Entity';
import {
  PublishPlatformResult,
  PublishStatus,
} from '../../cross-platform/helpers/cross-platform.interface';
import { MediaStorageItem } from '../../asset-management/media-storage/media-storage.dto';

@Entity('publish_records')
export class PublishRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('text')
  content: string;

  @Column('jsonb', { nullable: true })
  mediaItems: MediaStorageItem[];

  @Column('jsonb')
  platforms: any[];

  @Column({ type: 'timestamp', nullable: true })
  scheduleTime: Date;

  @Column({
    type: 'enum',
    enum: PublishStatus,
  })
  status: PublishStatus;

  @Column('jsonb', { nullable: true })
  results: PublishPlatformResult[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
