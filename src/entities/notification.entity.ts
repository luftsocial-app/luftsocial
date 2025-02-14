import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Users } from './user.entity'; // Assuming you have a User entity

@Entity()
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Users, (user) => user.notifications)
    @JoinColumn({ name: 'userId' })
    user: Users;

    @Column()
    userId: number;

    @Column()
    message: string;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @Column({ type: 'boolean', default: false })
    isEmailSent: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
