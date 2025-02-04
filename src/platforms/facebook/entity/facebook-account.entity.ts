import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { FacebookPage } from './facebook-page.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';

@Entity('facebook_accounts')
export class FacebookAccount {
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

    @Column()
    accessToken: string;

    @Column({ nullable: true })
    longLivedToken: string;

    @Column({ type: 'timestamp' })
    tokenExpiresAt: Date;

    @Column('jsonb')
    permissions: string[];

    @OneToMany(() => FacebookPage, page => page.facebookAccount)
    pages: FacebookPage[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}