import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { Message } from '../../entities/chats/message.entity';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), DatabaseModule],
  providers: [MessageService],
  controllers: [MessageController],
})
export class MessageModule {}
