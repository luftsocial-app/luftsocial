import { SocialPlatform } from '../../../common/enums/social-platform.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('auth_states')
export class AuthState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  state: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: SocialPlatform,
  })
  platform: SocialPlatform;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
