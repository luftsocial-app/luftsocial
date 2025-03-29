import { Column } from 'typeorm/decorator/columns/Column';
import { CreateDateColumn } from 'typeorm/decorator/columns/CreateDateColumn';
import { PrimaryGeneratedColumn } from 'typeorm/decorator/columns/PrimaryGeneratedColumn';
import { Entity } from 'typeorm/decorator/entity/Entity';
import { DateRange } from '../helpers/cross-platform.interface';
import { SocialPlatform } from '../../common/enums/social-platform.enum';

@Entity('analytics_records')
export class AnalyticsRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('jsonb')
  dateRange: DateRange;

  @Column('jsonb')
  platforms: {
    platform: SocialPlatform;
    accountId: string;
  }[];

  @Column('jsonb')
  results: any[];

  @CreateDateColumn()
  createdAt: Date;
}
