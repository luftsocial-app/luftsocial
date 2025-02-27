// stripe.controller.ts
import { Controller, Post, Body, HttpCode, Req, Get, HttpException, HttpStatus } from '@nestjs/common';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';
import { PinoLogger } from 'nestjs-pino';
import { CurrentUser } from '../../decorators/current-user.decorator';

@Controller('stripe')
export class StripeController {
    constructor(private readonly stripeService: StripeService, private readonly logger: PinoLogger) { }

    @Post('create-customer')
    async createCustomer(@Body('email') email: string) {
        const customer = await this.stripeService.createCustomer(email);
        return { customer };
    }

    @Post('create-subscription')
    async createSubscription(
        @Body('customerId') customerId: string,
        @Body('priceId') priceId: string,
    ) {
        const subscription = await this.stripeService.createSubscription(
            customerId,
            priceId,
        );
        return { subscription };
    }

    @Post('create-payment-intent')
    async createPaymentIntent(
        @Body('amount') amount: number,
        @Body('currency') currency: string,
    ): Promise<{ paymentIntentId: string }> {
        try {
            const paymentIntent = await this.stripeService.createPaymentIntent(
                amount,
                currency,
            );
            this.logger.info('Payment Intent created successfully');
            return { paymentIntentId: paymentIntent.id };
        } catch (error) {
            this.logger.error('Failed to create Payment Intent', error.stack);
            throw new HttpException(
                'Failed to create Payment Intent',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    @Post('add-payment-method')
    async addPaymentMethod(
        @CurrentUser() user: any,
        @Body('paymentMethodId') paymentMethodId: string,
    ): Promise<Stripe.PaymentMethod> {
        try {
            const paymentMethod = await this.stripeService.addPaymentMethod(
                user.sub,
                paymentMethodId,
            );
            this.logger.info('Payment method added successfully');
            return paymentMethod;
        } catch (error) {
            this.logger.error('Failed to add payment method', error.stack);
            throw new HttpException(
                'Failed to add payment method',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('get-payment-methods')
    async retrievePaymentMethods(
        @CurrentUser() user: any,
    ): Promise<Stripe.PaymentMethod[]> {
        try {
            const paymentMethods = await this.stripeService.retrievePaymentMethods(
                user.sub,
            );
            this.logger.info('Payment methods fetched successfully');
            return paymentMethods;
        } catch (error) {
            this.logger.error('Failed to fetch payment methods', error.stack);
            throw new HttpException(
                'Failed to fetch payment methods',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    @Post('confirm-payment-intent')
    async confirmPaymentIntent(
        @Body('paymentIntentId') paymentIntentId: string,
        @Body('paymentMethodId') paymentMethodId: string,
    ): Promise<Stripe.PaymentIntent> {
        try {
            const paymentIntent = await this.stripeService.paymentConfirmation(
                paymentIntentId,
                paymentMethodId,
            );
            this.logger.info('Payment Intent confirmed successfully');
            return paymentIntent;
        } catch (error) {
            this.logger.error('Failed to confirm Payment Intent', error.stack);
            throw new HttpException(
                'Failed to confirm Payment Intent',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    @Post('create-invoice')
    async createInvoice(@Body('customerId') customerId: string) {
        const invoice = await this.stripeService.createInvoice(customerId);
        return { invoice };
    }

    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(@Req() req: Request) {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = 'your_stripe_webhook_secret';
        return this.stripeService.handleWebhook(
            req.body,
            sig,
            endpointSecret,
        );


    }
}
