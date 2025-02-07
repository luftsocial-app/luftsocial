import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, DeleteDateColumn } from 'typeorm';
import { Group } from './group.entity';
import { Users } from './user.entity';  // Assuming you already have a User entity

@Entity()
export class GroupMember {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Group, (group) => group.members)
    @JoinColumn({ name: 'groupId' })
    group: Group;

    @Column()
    groupId: number;

    @ManyToOne(() => Users, (user) => user.groupMembers)
    @JoinColumn({ name: 'userId' })
    user: Users;

    @Column()
    userId: number;

    @Column({ type: 'boolean', default: true })
    isActive: boolean; // Marks if the member is active in the group

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    joinedAt: Date;

    // @DeleteDateColumn({ nullable: true })
    // deletedAt: Date; // Soft delete

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @Column({ type: 'enum', enum: ['member', 'admin'], default: 'member' })
    role: 'member' | 'admin';
}