import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { TenantModule } from '../tenant/tenant.module';
import { ClerkWebhookService } from './clerk-webhook.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule, TenantModule],
  providers: [ClerkWebhookService],
  controllers: [ClerkWebhookController],
  exports: [ClerkWebhookService],
})
export class ClerkWebhookModule {}
