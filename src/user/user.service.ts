import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from '../entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,

    @InjectRepository(Users) private userRepo: Repository<Users>,
  ) {
    this.logger.setContext(UserService.name);
  }

  async createUser(newUser: any): Promise<void> {
    try {
      console.log('User created successfully', newUser);
    } catch (error) {
      this.logger.error('Error creating user', error);
      throw error;
    }
  }

  async updateUser(userId: string, updateUser: any): Promise<void> {
    try {
      this.logger.info('User updated successfully', userId);
    } catch (error) {
      this.logger.error('Error updating user', error);
      throw error;
    }
  }

  async getUser(userId: string): Promise<any> {
    try {
      this.logger.info('User retrieved successfully', userId);
    } catch (error) {
      this.logger.error('Error retrieving user', error);
      throw error;
    }
  }

  async resetPassword(username: string): Promise<void> {
    try {
      this.logger.info('Password reset successfully', username);
    } catch (error) {
      this.logger.error('Error resetting password', error);
      throw error;
    }
  }

  async adminChangePassword(userId: string): Promise<void> {
    try {
      this.logger.info('Password changed successfully', userId);
    } catch (error) {
      this.logger.error('Error changing password', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      this.logger.info('User deleted successfully', userId);
    } catch (error) {
      this.logger.error('Error deleting user', error);
      throw error;
    }
  }
}
