import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/users/user.entity';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  constructor(
    @Inject('STRIPE_API_KEY') private readonly apiKey: string,
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly logger: PinoLogger,
  ) {
    this.stripe = new Stripe(this.apiKey, {
      apiVersion: this.configService.get('stripe-api-version'),
    });
  }

  async createCustomer(email: string): Promise<Stripe.Customer> {
    //save to database
    const newStripeUser = this.stripe.customers.create({ email });
    //update the user with the stripe customer id
    // await this.userRepo.update({where : {}}, newStripeUser);
    return newStripeUser;
  }

  async createSubscription(
    customerId: string,
    priceId: string,
  ): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        payment_method_types: ['card'],
      });
      this.logger.info('Payment Intent created successfully');
      return paymentIntent;
    } catch (error) {
      this.logger.error('Failed to create Payment Intent', error.stack);
      throw new Error('Unable to create Payment Intent');
    }
  }

  async addPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const userDetails = await this.userRepo.findOne({
        where: { id: userId },
      });

      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: userDetails.stripeCustomerId,
        },
      );

      return paymentMethod;
    } catch (error) {
      this.logger.error('Failed to add payment method', error.stack);
      throw error;
    }
  }

  async retrievePaymentMethods(
    userId: string,
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const userDetails = await this.userRepo.findOne({
        where: { id: userId },
      });
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: userDetails.stripeCustomerId,
        type: 'card',
      });
      return paymentMethods.data;
    } catch (error) {
      this.logger.error('Failed to fetch payment methods', error.stack);
      throw error;
    }
  }

  async paymentConfirmation(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const confirmedPaymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        },
      );
      return confirmedPaymentIntent;
    } catch (error) {
      this.logger.error('Failed to confirm Payment Intent', error.stack);
      throw new Error('Unable to confirm Payment Intent');
    }
  }

  async createInvoice(customerId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.create({
      customer: customerId,
    });
  }

  // Add other Stripe methods you may need, like handling webhooks, etc.

  handleWebhook(payload: any, sig: string, endpointSecret: string) {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      sig,
      endpointSecret,
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Handle payment success
        break;
      case 'invoice.payment_succeeded':
        // Handle invoice paid
        break;
      case 'invoice.payment_failed':
        // Handle payment failure
        break;
      // Add other event types you want to handle
      default:
        console.log('Unhandled event type:', event.type);
    }

    return { received: true };
  }
}
