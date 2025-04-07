import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { ClerkWebhookService } from './clerk-webhook.service';
import { UserManagementModule } from '../../user-management/user-management.module';
import { ClerkWebhookProcessor } from './clerk-webhook.processor';
import { BullQueueModule } from '../../bull-queue/bull-queue.module';

@Module({
  imports: [UserManagementModule, BullQueueModule],
  providers: [ClerkWebhookService, ClerkWebhookProcessor],
  controllers: [ClerkWebhookController],
  exports: [ClerkWebhookService],
})
export class ClerkWebhookModule {}
