import { Column } from 'typeorm/decorator/columns/Column';
import { CreateDateColumn } from 'typeorm/decorator/columns/CreateDateColumn';
import { PrimaryGeneratedColumn } from 'typeorm/decorator/columns/PrimaryGeneratedColumn';
import { UpdateDateColumn } from 'typeorm/decorator/columns/UpdateDateColumn';
import { Entity } from 'typeorm/decorator/entity/Entity';
import { PublishStatus } from '../helpers/cross-platform.interface';

@Entity('publish_records')
export class PublishRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('text')
  content: string;

  @Column('simple-array', { nullable: true })
  mediaUrls: string[];

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
  results: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
