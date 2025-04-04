import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'post_assets' })
export class PostAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  fileKey: string;

  @Column()
  fileType: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
