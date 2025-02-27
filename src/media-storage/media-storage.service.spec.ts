import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';
import { S3 } from 'aws-sdk';
import axios from 'axios';
import { MediaType } from 'src/common/enums/media-type.enum';
import { BadRequestException } from '@nestjs/common';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MediaStorageService', () => {
  let service: MediaStorageService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;

  // Spy on S3 methods
  const uploadSpy = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
      Location: 'https://bucket.s3.region.amazonaws.com/key',
      ETag: '"etag"',
    }),
  });

  const getSignedUrlPromiseSpy = jest
    .fn()
    .mockResolvedValue('https://presigned-url.com');

  // Mock S3 constructor and its methods
  jest.mock('aws-sdk', () => ({
    S3: jest.fn().mockImplementation(() => ({
      upload: uploadSpy,
      getSignedUrlPromise: getSignedUrlPromiseSpy,
    })),
  }));

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test-key',
                AWS_SECRET_ACCESS_KEY: 'test-secret',
                AWS_S3_BUCKET: 'test-bucket',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediaStorageService>(MediaStorageService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock S3 implementation
    jest.spyOn(service, 's3', 'get').mockReturnValue({
      upload: uploadSpy,
      getSignedUrlPromise: getSignedUrlPromiseSpy,
    } as unknown as S3);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload a file to S3 and return results', async () => {
      const key = 'test-key';
      const fileBuffer = Buffer.from('test-content');

      const result = await service.uploadFile(key, fileBuffer);

      expect(uploadSpy).toHaveBeenCalledWith(
        {
          Bucket: 'test-bucket',
          Key: key,
          Body: fileBuffer,
        },
        { queueSize: 10 },
      );

      expect(result).toEqual({
        sendData: {
          Location: 'https://bucket.s3.region.amazonaws.com/key',
          ETag: '"etag"',
        },
        cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
      });
    });

    it('should use custom options when provided', async () => {
      const key = 'test-key';
      const fileBuffer = Buffer.from('test-content');
      const options = { queueSize: 5, partSize: 1024 * 1024 * 5 };

      await service.uploadFile(key, fileBuffer, options);

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          queueSize: 5,
          partSize: 1024 * 1024 * 5,
        }),
      );
    });

    it('should use custom bucket when provided', async () => {
      const key = 'test-key';
      const fileBuffer = Buffer.from('test-content');
      const customBucket = 'custom-bucket';

      await service.uploadFile(key, fileBuffer, undefined, customBucket);

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: customBucket,
        }),
        expect.anything(),
      );
    });
  });

  describe('uploadPostMedia', () => {
    it('should upload multiple files and return media items', async () => {
      // Mock service.uploadFile to return expected result
      jest.spyOn(service, 'uploadFile').mockResolvedValue({
        sendData: {
          Location: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
          ETag: '"etag"',
          Bucket: 'loft-social-test-bucket',
          Key: 'secret-key',
        },
        cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
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

      // Mock service.uploadFile
      jest.spyOn(service, 'uploadFile').mockResolvedValue({
        sendData: {
          Location: 'test-location',
          ETag: '"etag"',
          Bucket: 'loft-social-test-bucket',
          Key: 'secret-key',
        },
        cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
      });

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
    it('should generate a pre-signed URL', async () => {
      const key = 'test-key';
      const contentType = 'image/jpeg';

      const result = await service.createPreSignedUrl(key, contentType);

      expect(getSignedUrlPromiseSpy).toHaveBeenCalledWith('putObject', {
        Bucket: 'test-bucket',
        Key: key,
        ContentType: contentType,
        Expires: 360,
      });

      expect(result).toEqual({
        preSignedUrl: 'https://presigned-url.com',
        contentType: 'image/jpeg',
        cdnUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test-key',
        bucket: 'test-bucket',
        key: 'test-key',
      });
    });

    it('should use custom bucket when provided', async () => {
      const key = 'test-key';
      const contentType = 'image/jpeg';
      const customBucket = 'custom-bucket';

      await service.createPreSignedUrl(key, contentType, customBucket);

      expect(getSignedUrlPromiseSpy).toHaveBeenCalledWith(
        'putObject',
        expect.objectContaining({
          Bucket: customBucket,
        }),
      );
    });
  });

  describe('private methods', () => {
    describe('generatePostMediaKey', () => {
      it('should generate a key with the correct format', () => {
        // Mock Math.random for deterministic testing
        const originalRandom = Math.random;
        Math.random = jest.fn().mockReturnValue(0.123456789);

        // Mock Date.now()
        const originalDateNow = Date.now;
        Date.now = jest.fn().mockReturnValue(1609459200000); // 2021-01-01

        const userId = 'user123';
        const filename = 'test.jpg';

        const key = service['generatePostMediaKey'](userId, filename);

        // Restore original functions
        Math.random = originalRandom;
        Date.now = originalDateNow;

        expect(key).toBe('social-media/user123/1609459200000-4fzfyswa8v.jpg');
      });

      it('should include postId in the key when provided', () => {
        // Mock functions for deterministic testing
        const originalRandom = Math.random;
        Math.random = jest.fn().mockReturnValue(0.123456789);
        const originalDateNow = Date.now;
        Date.now = jest.fn().mockReturnValue(1609459200000);

        const userId = 'user123';
        const filename = 'test.jpg';
        const postId = 'post456';

        const key = service['generatePostMediaKey'](userId, filename, postId);

        // Restore original functions
        Math.random = originalRandom;
        Date.now = originalDateNow;

        expect(key).toBe(
          'social-media/user123/post456/1609459200000-4fzfyswa8v.jpg',
        );
      });
    });

    describe('getFileExtension', () => {
      it('should extract file extension correctly', () => {
        expect(service['getFileExtension']('test.jpg')).toBe('jpg');
        expect(service['getFileExtension']('test.name.with.dots.png')).toBe(
          'png',
        );
      });

      it('should return "bin" when no extension exists', () => {
        expect(service['getFileExtension']('test')).toBe('bin');
      });
    });

    describe('getMediaType', () => {
      it('should identify image media types', () => {
        expect(service['getMediaType']('image/jpeg')).toBe(MediaType.IMAGE);
        expect(service['getMediaType']('image/png')).toBe(MediaType.IMAGE);
      });

      it('should identify video media types', () => {
        expect(service['getMediaType']('video/mp4')).toBe(MediaType.VIDEO);
        expect(service['getMediaType']('video/quicktime')).toBe(
          MediaType.VIDEO,
        );
      });

      it('should identify audio media types', () => {
        expect(service['getMediaType']('audio/mpeg')).toBe(MediaType.AUDIO);
        expect(service['getMediaType']('audio/wav')).toBe(MediaType.AUDIO);
      });

      it('should default to FILE for other types', () => {
        expect(service['getMediaType']('application/pdf')).toBe(MediaType.FILE);
        expect(service['getMediaType']('text/html')).toBe(MediaType.FILE);
      });
    });

    describe('getFilenameFromUrl', () => {
      it('should extract filename from URL', () => {
        expect(
          service['getFilenameFromUrl']('https://example.com/path/image.jpg'),
        ).toBe('image.jpg');
      });

      it('should generate a timestamp filename when URL has no filename', () => {
        // Mock Date.now()
        const originalDateNow = Date.now;
        Date.now = jest.fn().mockReturnValue(1609459200000);

        expect(service['getFilenameFromUrl']('https://example.com/')).toBe(
          'file-1609459200000',
        );

        // Restore original Date.now
        Date.now = originalDateNow;
      });

      it('should generate a timestamp filename for invalid URLs', () => {
        // Mock Date.now()
        const originalDateNow = Date.now;
        Date.now = jest.fn().mockReturnValue(1609459200000);

        expect(service['getFilenameFromUrl']('not-a-valid-url')).toBe(
          'file-1609459200000',
        );

        // Restore original Date.now
        Date.now = originalDateNow;
      });
    });
  });
});
