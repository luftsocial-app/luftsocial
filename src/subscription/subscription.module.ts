import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { StripeModule } from './stripe/stripe.module';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  imports: [StripeModule],
})
export class SubscriptionModule {}
