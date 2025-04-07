import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { ClerkWebhookService } from './clerk-webhook.service';
import { UserManagementModule } from '../../user-management/user-management.module';

@Module({
  imports: [UserManagementModule],
  providers: [ClerkWebhookService],
  controllers: [ClerkWebhookController],
  exports: [ClerkWebhookService],
})
export class ClerkWebhookModule {}
