import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { FacebookPost } from './facebook-post.entity';

@Entity('facebook_post_metrics')
export class FacebookPostMetric {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => FacebookPost, post => post.metrics)
    post: FacebookPost;

    @Column({ default: 0 })
    likesCount: number;

    @Column({ default: 0 })
    commentsCount: number;

    @Column({ default: 0 })
    sharesCount: number;

    @Column({ default: 0 })
    reach: number;

    @Column({ default: 0 })
    impressions: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    engagementRate: number;

    @Column('jsonb', { nullable: true })
    demographicBreakdown: any;

    @Column({ type: 'timestamp' })
    collectedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @CreateDateColumn()
    updatedAt: Date;
}