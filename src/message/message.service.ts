import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) { }
  async getMessageHistory(userId: number): Promise<{ data: Message[]; status: number }> {
    try {
      const messageHistory = await this.messageRepository.find({
        where: [
          { senderId: userId },
          { receiverId: userId },
        ],
        order: { sentAt: 'ASC' },
      });
      if (messageHistory.length > 0) {
      return {
        status: 1,
        data: messageHistory,
      };
    }
      return {
        status: 0,
        data: [],
      }
    } catch (err) {
      throw new HttpException(err.message || err, HttpStatus.BAD_REQUEST);
    }
  }
}

