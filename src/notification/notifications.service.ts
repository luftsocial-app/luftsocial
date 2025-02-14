import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async createNotification(userId: number, message: string) {
    const notification = this.notificationRepository.create({
      userId, // Explicitly set userId
      message,
    });
    return this.notificationRepository.save(notification);
  }

  async getNotifications(userId: number) {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: number) {
    return this.notificationRepository.update(id, { isRead: true });
  }
}
