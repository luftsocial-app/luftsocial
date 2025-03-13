import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { FacebookAccount } from './facebook-account.entity';
import { FacebookPost } from './facebook-post.entity';
import { TenantEntity } from '../../notifications/entity/tenant-entity';


@Entity('facebook_pages')
export class FacebookPage extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FacebookAccount, (account) => account.pages)
  facebookAccount: FacebookAccount;

  @Column()
  pageId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  about: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  accessToken: string;

  @Column('jsonb')
  permissions: string[];

  @Column({ nullable: true })
  followerCount: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => FacebookPost, (post) => post.page)
  posts: FacebookPost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
