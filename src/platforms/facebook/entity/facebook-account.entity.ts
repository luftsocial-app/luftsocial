import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { FacebookPage } from './facebook-page.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';
import { TenantEntity } from 'src/platforms/entity/tenant-entity';

@Entity('facebook_accounts')
export class FacebookAccount extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => SocialAccount)
  @JoinColumn()
  socialAccount: SocialAccount;

  @Column()
  facebookUserId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  profileUrl: string;

  @Column('jsonb')
  permissions: string[];

  @OneToMany(() => FacebookPage, (page) => page.facebookAccount)
  pages: FacebookPage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
