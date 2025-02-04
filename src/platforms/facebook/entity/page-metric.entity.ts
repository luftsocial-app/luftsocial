import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { FacebookPage } from './facebook-page.entity';


@Entity('facebook_page_metrics')
export class FacebookPageMetric {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => FacebookPage)
    page: FacebookPage;

    @Column({ type: 'int' })
    followerCount: number;

    @Column({ type: 'int' })
    fanCount: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    engagement: number;

    @Column({ type: 'int' })
    impressions: number;

    @Column({ type: 'int' })
    reach: number;

    @Column('jsonb')
    demographics: any;

    @Column()
    collectedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}