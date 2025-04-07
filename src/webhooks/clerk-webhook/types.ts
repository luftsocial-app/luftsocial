import { WebhookEvent as ClerkWebhookEvent } from '@clerk/express';

type WaitlistEntryType = 'waitlistEntry.created' | 'waitlistEntry.updated';
type UserEventType = 'user.created' | 'user.updated' | 'user.deleted';
type SessionEventType = 'session.created' | 'session.ended';
type OrganizationEventType =
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted';

export type WebhookEventType =
  | WaitlistEntryType
  | UserEventType
  | SessionEventType
  | OrganizationEventType;

export interface WebhookJobData {
  event: ClerkWebhookEvent;
}

export interface WebhookJobResult {
  success: boolean;
  message?: string;
  processedAt: Date;
}
