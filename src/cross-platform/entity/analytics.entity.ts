import { SocialPlatform } from 'src/enum/social-platform.enum';
import { Column } from 'typeorm/decorator/columns/Column';
import { CreateDateColumn } from 'typeorm/decorator/columns/CreateDateColumn';
import { PrimaryGeneratedColumn } from 'typeorm/decorator/columns/PrimaryGeneratedColumn';
import { Entity } from 'typeorm/decorator/entity/Entity';
import { DateRange } from '../helpers/cross-platform.interface';

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
