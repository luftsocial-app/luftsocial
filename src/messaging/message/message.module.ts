import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { Message } from '../../entities/chats/message.entity';
import { TenantAwareRepoModule } from '../../tenant-aware-repo/tenant-aware-repo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    TenantAwareRepoModule.forFeature([Message]),
  ],
  providers: [MessageService],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
