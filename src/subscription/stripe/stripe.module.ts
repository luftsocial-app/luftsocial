import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/users/user.entity';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [StripeController],
  providers: [
    StripeService,
    {
      provide: 'STRIPE_API_KEY',
      useFactory: async (configService: ConfigService) =>
        configService.get('stripe-secret-key'),
      inject: [ConfigService],
    },
  ],
  exports: [StripeService],
})
export class StripeModule {}
