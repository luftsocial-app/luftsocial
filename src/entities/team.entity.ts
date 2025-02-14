import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, UpdateDateColumn, CreateDateColumn, DeleteDateColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

@Entity({ name: "tbl_teams" })
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ name: 'description', nullable: true })
    description: string;

    // Team belongs to one tenant
    @ManyToOne(() => Tenant, (tenant) => tenant.id, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "tenant_id" })
    tenantId: Tenant;

    // Team has multiple users
    @ManyToMany(() => User, (user) => user.teams)
    @JoinTable({
        name: 'tbL_user_team',
        joinColumn: { name: 'teamId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    })
    users: User[];

    @Column({ name: 'status', type: 'boolean', default: true })
    status: boolean;

    @ManyToOne(() => User, (user) => user.createdTeams)
    @JoinColumn({ name: 'created_by' })
    createdBy: User;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt?: Date;
}