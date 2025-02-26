import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { FacebookPage } from './facebook-page.entity';
import { TenantEntity } from 'src/platforms/entity/tenant-entity';

@Entity('facebook_page_metrics')
export class FacebookPageMetric extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FacebookPage)
  page: FacebookPage;

  @Column()
  impressions: number;

  @Column()
  engagedUsers: number;

  @Column()
  newFans: number;

  @Column()
  pageViews: number;

  @Column()
  engagements: number;

  @Column()
  followers: number;

  @Column({ type: 'timestamp' })
  collectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
