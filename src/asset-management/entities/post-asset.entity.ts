import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('post_assets')
export class PostAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  tenantId: string;

  @Column({ nullable: true })
  @Index()
  postId: string;

  @Column({ nullable: false })
  fileKey: string;

  @Column({ nullable: false })
  fileType: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true, type: 'bigint' })
  fileSize: number;

  @Column({ nullable: true })
  @Index()
  fileHash: string;

  @Column({ default: false })
  isPending: boolean;

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;
}
