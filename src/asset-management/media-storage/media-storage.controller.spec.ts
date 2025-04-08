import { Test, TestingModule } from '@nestjs/testing';
import { MediaStorageController } from './media-storage.controller';
import { MediaStorageService } from './media-storage.service';
import { PinoLogger } from 'nestjs-pino';
import { AuthObject } from '@clerk/express';

describe('MediaStorageController', () => {
  let controller: MediaStorageController;
  let mediaStorageService: MediaStorageService;

  const mockMediaStorageService = {
    generatePreSignedUrl: jest.fn(),
    getTenantUploads: jest.fn(),
    generateUploadURL: jest.fn(),
    generateDownloadURL: jest.fn(),
    generateViewURL: jest.fn(),
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
      const mockUser = { orgId: 'org123' } as unknown as AuthObject;
      const fileName = 'test.jpg';
      const fileType = 'image/jpeg';
      const expectedResult = {
        preSignedUrl: 'https://test-url.com',
        cdnUrl: 'https://cdn-url.com',
      };

      mockMediaStorageService.generatePreSignedUrl.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.getPresignedUrl(
        mockUser,
        fileName,
        fileType,
      );

      expect(mediaStorageService.generatePreSignedUrl).toHaveBeenCalledWith(
        fileName,
        fileType,
        mockUser.orgId,
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

  describe('getS3Items', () => {
    it('should return a view URL', async () => {
      const userId = 'user-123';
      const key = 'users/user-123/media/image.jpg';
      const mockResponse = { url: 'https://example.com/view-url' };

      const user = { userId: userId } as unknown as AuthObject;
      jest
        .spyOn(mediaStorageService, 'generateViewURL')
        .mockResolvedValue(mockResponse);

      const result = await controller.getViewUrl(user, key);

      expect(result).toEqual(mockResponse);
      expect(mediaStorageService.generateViewURL).toHaveBeenCalledWith(
        userId,
        key,
      );
    });

    it('should return a download URL', async () => {
      const userId = 'user-123';
      const key = 'users/user-123/media/image.jpg';
      const mockResponse = { url: 'https://example.com/download-url' };

      const user = { userId } as unknown as AuthObject;

      jest
        .spyOn(mediaStorageService, 'generateDownloadURL')
        .mockResolvedValue(mockResponse);

      const result = await controller.getDownloadUrl(user, key);

      expect(result).toEqual(mockResponse);
      expect(mediaStorageService.generateDownloadURL).toHaveBeenCalledWith(
        userId,
        key,
      );
    });
  });
});
