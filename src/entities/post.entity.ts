import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tbl_posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ name: 'title' })
  title: string;

  @Column()
  content: string;

  @Column({ name: 'Tenant_id' })
  TenantId: string; // Add TenantId to the Post entity

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
