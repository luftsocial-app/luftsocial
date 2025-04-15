import { Test, TestingModule } from '@nestjs/testing';
import { MediaStorageController } from './media-storage.controller';
import { MediaStorageService } from './media-storage.service';
import { PinoLogger } from 'nestjs-pino';
import { AuthObject } from '@clerk/express';
import { SocialPlatform } from '../../common/enums/social-platform.enum';

describe('MediaStorageController', () => {
  let controller: MediaStorageController;
  let mediaStorageService: MediaStorageService;

  const mockMediaStorageService = {
    generatePreSignedUrl: jest.fn(),
    getTenantUploads: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaStorageController],
      providers: [
        {
          provide: MediaStorageService,
          useValue: mockMediaStorageService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<MediaStorageController>(MediaStorageController);
    mediaStorageService = module.get<MediaStorageService>(MediaStorageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPresignedUrl', () => {
    it('should return presigned url', async () => {
      const mockUser = {
        orgId: 'org123',
        userId: 'user_123',
      } as unknown as AuthObject;
      const platform = SocialPlatform.FACEBOOK;
      // const tenantId = 'tenant123';
      const fileName = 'test.jpg';
      const fileType = 'image/jpeg';
      const expectedResult = {
        preSignedUrl: 'https://test-url.com',
        cdnUrl: 'https://cdn-url.com',
      };

      const fileHash = undefined;

      mockMediaStorageService.generatePreSignedUrl.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.getPresignedUrl(
        mockUser,
        fileName,
        fileType,
        fileHash,
        platform,
      );

      expect(mediaStorageService.generatePreSignedUrl).toHaveBeenCalledWith(
        mockUser.userId,
        fileName,
        fileType,
        fileHash,
        platform,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getTenantUploads', () => {
    it('should return tenant uploads', async () => {
      const mockUser = { orgId: 'org123' } as unknown as AuthObject;
      const mockUploads = [
        { id: 1, fileKey: 'key1' },
        { id: 2, fileKey: 'key2' },
      ];

      mockMediaStorageService.getTenantUploads.mockResolvedValue(mockUploads);

      const result = await controller.getTenantUploads(mockUser);

      expect(mediaStorageService.getTenantUploads).toHaveBeenCalledWith(
        mockUser.orgId,
      );
      expect(result).toEqual(mockUploads);
    });
  });
});
