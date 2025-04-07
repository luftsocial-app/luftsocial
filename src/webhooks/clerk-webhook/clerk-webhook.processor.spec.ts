import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ClerkWebhookProcessor } from './clerk-webhook.processor';
import { ClerkWebhookService } from './clerk-webhook.service';
import { WebhookEvent } from '@clerk/backend';

describe('ClerkWebhookProcessor', () => {
  let processor: ClerkWebhookProcessor;
  let mockClerkWebhookService: jest.Mocked<ClerkWebhookService>;
  let mockLogger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    mockClerkWebhookService = {
      processWebhookEvent: jest.fn(),
    } as any;

    mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkWebhookProcessor,
        {
          provide: ClerkWebhookService,
          useValue: mockClerkWebhookService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    processor = module.get<ClerkWebhookProcessor>(ClerkWebhookProcessor);
  });

  describe('process', () => {
    const mockEvent: WebhookEvent = {
      data: { id: 'user_123' },
      object: 'event',
      type: 'user.created',
    } as WebhookEvent;

    const mockJob = {
      id: '123',
      data: { event: mockEvent },
    } as Job;

    it('should successfully process webhook event', async () => {
      mockClerkWebhookService.processWebhookEvent.mockResolvedValueOnce(
        undefined,
      );

      const result = await processor.process(mockJob);

      expect(result).toEqual({
        success: true,
        message: 'Webhook processed successfully',
        processedAt: expect.any(Date),
      });
      expect(mockClerkWebhookService.processWebhookEvent).toHaveBeenCalledWith(
        mockEvent,
      );
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should handle processing errors', async () => {
      const error = new Error('Processing failed');
      mockClerkWebhookService.processWebhookEvent.mockRejectedValueOnce(error);

      await expect(processor.process(mockJob)).rejects.toEqual({
        success: false,
        message: 'Processing failed',
        processedAt: expect.any(Date),
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process webhook job'),
      );
    });

    it('should handle different webhook event types', async () => {
      const eventTypes = [
        'user.created',
        'user.updated',
        'organization.created',
      ];

      for (const type of eventTypes) {
        const event = { ...mockEvent, type };
        const job = { id: '123', data: { event } } as Job;

        mockClerkWebhookService.processWebhookEvent.mockResolvedValueOnce(
          undefined,
        );
        const result = await processor.process(job);
        expect(result.success).toBe(true);
      }
    });
  });
});
