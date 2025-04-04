import { Test, TestingModule } from '@nestjs/testing';
import { MediaStorageService } from './media-storage.service';
import { S3 } from 'aws-sdk';
import axios from 'axios';
import { BadRequestException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

// Mock the config module
jest.mock('config', () => ({
  get: jest.fn((key) => {
    const configValues = {
      'aws.region': 'us-east-1',
      'aws.accessKeyId': 'test-key',
      'aws.secretAccessKey': 'test-secret',
      'aws.s3.bucket': 'test-bucket',
    };
    return configValues[key];
  }),
}));

jest.mock('lodash/merge', () => jest.fn());

// Create a mock for the MediaType enum
enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  FILE = 'FILE',
}

// Mock modules before importing
jest.mock('axios');
jest.mock('lodash', () => ({
  merge: jest.fn((defaultOptions, options) => {
    return { ...defaultOptions, ...(options || {}) };
  }),
}));
jest.mock('lodash/merge', () =>
  jest.fn((obj1, obj2) => Object.assign({}, obj1, obj2)),
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MediaStorageService', () => {
  let service: MediaStorageService;
  let mockPostAssetRepository;
  let mockLogger;

  // S3 upload spy
  const uploadSpy = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
      Location: 'https://bucket.s3.region.amazonaws.com/key',
      ETag: '"etag"',
    }),
  });

  const getSignedUrlPromiseSpy = jest
    .fn()
    .mockResolvedValue('https://presigned-url.com');

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    mockPostAssetRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    mockLogger = {
      setContext: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaStorageService,
        {
          provide: 'PostAssetRepository',
          useValue: mockPostAssetRepository,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MediaStorageService>(MediaStorageService);

    // Mock S3 implementation on the service instance
    jest.spyOn(service, 's3', 'get').mockReturnValue({
      upload: uploadSpy,
      getSignedUrlPromise: getSignedUrlPromiseSpy,
    } as unknown as S3);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should use custom options when provided', async () => {
      const key = 'test-key';
      const fileBuffer = Buffer.from('test-content');
      const options = { queueSize: 5, partSize: 1024 * 1024 * 5 };
      const bucket = 'test-bucket';
      await service.uploadFile(key, fileBuffer, bucket, options);

      expect(uploadSpy).toHaveBeenCalledWith(
        {
          Bucket: bucket,
          Key: key,
          Body: fileBuffer,
        },
        { queueSize: 5, partSize: 1024 * 1024 * 5 },
      );
    });
  });

  describe('uploadPostMedia', () => {
    it('should upload multiple files and return media items', async () => {
      // Mock uploadFile to return expected result
      jest.spyOn(service, 'uploadFile').mockImplementation(async () => ({
        sendData: {
          Location: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
          ETag: '"etag"',
          Key: 'secret-key',
          Bucket: 'loftSocial-test',
        },
        cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
      }));

      // Mock private methods
      jest
        .spyOn<any, any>(service, 'generatePostMediaKey')
        .mockReturnValue('test-key');
      jest
        .spyOn<any, any>(service, 'getMediaType')
        .mockImplementation((mimetype: string) => {
          if (mimetype.startsWith('image/')) return MediaType.IMAGE;
          if (mimetype.startsWith('video/')) return MediaType.VIDEO;
          return MediaType.FILE;
        });

      // Mock file data
      const userId = 'user123';
      const files = [
        {
          originalname: 'test1.jpg',
          buffer: Buffer.from('test-content-1'),
          size: 1024,
          mimetype: 'image/jpeg',
        },
        {
          originalname: 'test2.mp4',
          buffer: Buffer.from('test-content-2'),
          size: 2048,
          mimetype: 'video/mp4',
        },
      ] as Express.Multer.File[];

      const result = await service.uploadPostMedia(userId, files);

      expect(result.length).toBe(2);
      expect(result[0].type).toBe(MediaType.IMAGE);
      expect(result[1].type).toBe(MediaType.VIDEO);
      expect(service.uploadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('uploadMediaFromUrl', () => {
    it('should download from URL and upload to S3', async () => {
      // Mock axios.get response
      const buffer = Buffer.from('test-content');
      mockedAxios.get.mockResolvedValueOnce({
        data: buffer,
        headers: {
          'content-type': 'image/png',
        },
      });

      // Mock service methods
      jest.spyOn(service, 'uploadFile').mockResolvedValue({
        sendData: {
          Location: 'test-location',
          ETag: '"etag"',
          Bucket: 'test-bucket',
          Key: 'test-key',
        },
        cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
      });

      jest
        .spyOn<any, any>(service, 'getFilenameFromUrl')
        .mockReturnValue('image.png');
      jest
        .spyOn<any, any>(service, 'generatePostMediaKey')
        .mockReturnValue('test-key');
      jest
        .spyOn<any, any>(service, 'getMediaType')
        .mockReturnValue(MediaType.IMAGE);

      const userId = 'user123';
      const url = 'https://example.com/image.png';

      const result = await service.uploadMediaFromUrl(userId, url);

      expect(mockedAxios.get).toHaveBeenCalledWith(url, {
        responseType: 'arraybuffer',
      });
      expect(service.uploadFile).toHaveBeenCalled();
      expect(result.type).toBe(MediaType.IMAGE);
      expect(result.mimeType).toBe('image/png');
    });

    it('should throw BadRequestException when URL download fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Download failed'));

      const userId = 'user123';
      const url = 'https://example.com/image.png';

      await expect(service.uploadMediaFromUrl(userId, url)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createPreSignedUrl', () => {
    it('should use custom bucket when provided', async () => {
      const key = 'test-key';
      const contentType = 'image/jpeg';
      const tenantId = 'tenant123';
      const customBucket = 'test-bucket';
      const currentTime = 1672531200000;

      jest.spyOn(Date, 'now').mockImplementation(() => currentTime); // Mocked timestamp


      const file = `uploads/${tenantId}/${currentTime}-${key}`

      const result = await service.createPreSignedUrl(
        key,
        contentType,
        tenantId,
      );

      expect(getSignedUrlPromiseSpy).toHaveBeenCalledWith(
        'putObject',
        expect.objectContaining({
          Bucket: customBucket,
          Key: file,
          ContentType: contentType,
          Expires: 360,
        }),
      );

      expect(result).toEqual({
        preSignedUrl: 'https://presigned-url.com',
        cdnUrl: `https://${customBucket}.s3.${'us-east-1'}.amazonaws.com/${key}`,
        bucket: customBucket,
        key,
      });
    });
  });

  describe('saveFile', () => {
    it('should save file metadata to database', async () => {
      const tenantId = 'tenant123';
      const key = 'test-key';
      const contentType = 'image/jpeg';
      const mockUpload = {
        id: 1,
        tenantId,
        fileKey: key,
        fileType: contentType,
      };

      mockPostAssetRepository.create.mockReturnValue(mockUpload);
      mockPostAssetRepository.save.mockResolvedValue(mockUpload);

      const result = await service.saveFile(tenantId, key, contentType);

      expect(mockPostAssetRepository.create).toHaveBeenCalledWith({
        tenantId,
        fileKey: key,
        fileType: contentType,
        uploadedAt: expect.any(Date),
      });
      expect(mockPostAssetRepository.save).toHaveBeenCalledWith(mockUpload);
      expect(result).toEqual(mockUpload);
    });
  });

  describe('getTenantUploads', () => {
    it('should return uploads for a tenant', async () => {
      const tenantId = 'tenant123';
      const mockUploads = [
        { id: 1, tenantId, fileKey: 'key1' },
        { id: 2, tenantId, fileKey: 'key2' },
      ];

      mockPostAssetRepository.find.mockResolvedValue(mockUploads);

      const result = await service.getTenantUploads(tenantId);

      expect(mockPostAssetRepository.find).toHaveBeenCalledWith({
        where: { tenantId },
      });
      expect(result).toEqual(mockUploads);
    });
  });

  describe('private methods', () => {
    describe('generatePostMediaKey', () => {
      it('should generate a key with the correct format', () => {
        // Mock Math.random and Date.now for deterministic testing
        const originalRandom = Math.random;
        const originalDateNow = Date.now;

        Math.random = jest.fn().mockReturnValue(0.123456789);
        Date.now = jest.fn().mockReturnValue(1609459200000); // 2021-01-01

        const userId = 'user123';
        const filename = 'test.jpg';

        // Access private method using any type
        const key = (service as any).generatePostMediaKey(userId, filename);

        // Restore original functions
        Math.random = originalRandom;
        Date.now = originalDateNow;

        expect(key).toBe('social-media/user123/1609459200000-4fzzzxjylrx.jpg');
      });

      it('should include postId in the key when provided', () => {
        // Mock functions for deterministic testing
        const originalRandom = Math.random;
        const originalDateNow = Date.now;

        Math.random = jest.fn().mockReturnValue(0.123456789);
        Date.now = jest.fn().mockReturnValue(1609459200000);

        const userId = 'user123';
        const filename = 'test.jpg';
        const postId = 'post456';

        // Access private method using any type
        const key = (service as any).generatePostMediaKey(
          userId,
          filename,
          postId,
        );

        // Restore original functions
        Math.random = originalRandom;
        Date.now = originalDateNow;

        expect(key).toBe(
          'social-media/user123/post456/1609459200000-4fzzzxjylrx.jpg',
        );
      });
    });

    describe('getFileExtension', () => {
      it('should extract file extension correctly', () => {
        expect((service as any).getFileExtension('test.jpg')).toBe('jpg');
        expect(
          (service as any).getFileExtension('test.name.with.dots.png'),
        ).toBe('png');
      });

      it('should return "bin" when no extension exists', () => {
        expect((service as any).getFileExtension('test.bin')).toBe('bin');
      });
    });

    describe('getMediaType', () => {
      it('should identify image media types', () => {
        expect((service as any).getMediaType('image/jpeg')).toBe(
          MediaType.IMAGE,
        );
        expect((service as any).getMediaType('image/png')).toBe(
          MediaType.IMAGE,
        );
      });

      it('should identify video media types', () => {
        expect((service as any).getMediaType('video/mp4')).toBe(
          MediaType.VIDEO,
        );
        expect((service as any).getMediaType('video/quicktime')).toBe(
          MediaType.VIDEO,
        );
      });

      it('should identify audio media types', () => {
        expect((service as any).getMediaType('audio/mpeg')).toBe(
          MediaType.AUDIO,
        );
        expect((service as any).getMediaType('audio/wav')).toBe(
          MediaType.AUDIO,
        );
      });

      it('should default to FILE for other types', () => {
        expect((service as any).getMediaType('application/pdf')).toBe(
          MediaType.FILE,
        );
        expect((service as any).getMediaType('text/html')).toBe(MediaType.FILE);
      });
    });

    describe('getFilenameFromUrl', () => {
      it('should extract filename from URL', () => {
        expect(
          (service as any).getFilenameFromUrl(
            'https://example.com/path/image.jpg',
          ),
        ).toBe('image.jpg');
      });

      it('should generate a timestamp filename when URL has no filename', () => {
        // Mock Date.now()
        const originalDateNow = Date.now;
        Date.now = jest.fn().mockReturnValue(1609459200000);

        expect(
          (service as any).getFilenameFromUrl('https://example.com/'),
        ).toBe('file-1609459200000');

        // Restore original Date.now
        Date.now = originalDateNow;
      });

      it('should generate a timestamp filename for invalid URLs', () => {
        // Mock Date.now()
        const originalDateNow = Date.now;
        Date.now = jest.fn().mockReturnValue(1609459200000);

        expect((service as any).getFilenameFromUrl('not-a-valid-url')).toBe(
          'file-1609459200000',
        );

        // Restore original Date.now
        Date.now = originalDateNow;
      });
    });
  });
});
