import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tbl_posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column({ name: 'organization_id' })
  organizationId: string; // Add organizationId to the Post entity
}
