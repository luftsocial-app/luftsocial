import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { FacebookPage } from './facebook-page.entity';

@Entity('facebook_page_metrics')
export class FacebookPageMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  tenantId: string;

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
