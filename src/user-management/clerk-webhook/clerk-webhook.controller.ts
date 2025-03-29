import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Post,
  HttpException,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ClerkWebhookService } from './clerk-webhook.service';
import { Public } from 'src/decorators/public.decorator';
import { WebhookEvent } from '@clerk/express';
import { Webhook } from 'svix';

@Controller('/webhooks')
export class ClerkWebhookController {
  constructor(private readonly clerkWebhookService: ClerkWebhookService) {}

  @Public()
  @Post()
  async saveNewUser(@Body() clerkWebhookDto: any, @Req() req: Request) {
    try {
      console.log('Received webhook:', clerkWebhookDto);

      const SIGNING_SECRET = process.env.SIGNING_SECRET;

      if (!SIGNING_SECRET) {
        throw new Error(
          'Error: Please add SIGNING_SECRET from Clerk Dashboard to .env or .env',
        );
      }

      // Create new Svix instance with secret
      const wh = new Webhook(SIGNING_SECRET);

      // Get headers
      const svix_id = req.headers['svix-id'];
      const svix_timestamp = req.headers['svix-timestamp'];
      const svix_signature = req.headers['svix-signature'];

      // If there are no headers, error out
      if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response('Error: Missing Svix headers', {
          status: 400,
        });
      }

      // Get body
      const payload = await req.body;
      const body = JSON.stringify(payload);

      let evt: WebhookEvent;

      // Verify payload with headers
      try {
        evt = wh.verify(body, {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        }) as WebhookEvent;
      } catch (err) {
        console.error('Error: Could not verify webhook:', err);
        return new Response('Error: Verification error', {
          status: 400,
        });
      }

      // Do something with payload
      const { id } = evt.data;
      const eventType = evt.type;
      console.log(
        `Received webhook with ID ${id} and event type of ${eventType}`,
      );
      if (evt.type === 'user.created') {
        console.log('userId:', evt.data.id);
        // Create user in your database
        console.log({ 'Webhook payload:': body });
        await this.clerkWebhookService.createUser(evt);
      }

      if (evt.type === 'user.updated') {
        console.log('userId:', evt.data.id);
        // Create user in your database
        console.log({ 'Webhook payload:': body });
        await this.clerkWebhookService.updateUser(evt);
      }
      if (evt.type === 'organization.created') {
        console.log('userId:', evt.data.id);
        // Create user in your database
        console.log({ 'Webhook payload:': body });
        await this.clerkWebhookService.tenantCreated(evt);
      }
      if (evt.type === 'organization.updated') {
        console.log('userId:', evt.data.id);
        // Create user in your database
        console.log({ 'Webhook payload:': body });
        await this.clerkWebhookService.tenantUpdated(evt);
      }
      if (evt.type === 'organization.deleted') {
        console.log('userId:', evt.data.id);
        // Create user in your database
        console.log({ 'Webhook payload:': body });
        await this.clerkWebhookService.tenantDeleted(evt);
      }
      if (evt.type === 'organizationMembership.created') {
        console.log('userId:', evt.data.id);
        // Create user in your database
        console.log({ 'Webhook payload:': body });
        await this.clerkWebhookService.membershipCreated(evt);
      }

      return new Response('Webhook received', { status: 200 });
    } catch (error) {
      throw new HttpException(
        error.message,
        error instanceof BadRequestException
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
