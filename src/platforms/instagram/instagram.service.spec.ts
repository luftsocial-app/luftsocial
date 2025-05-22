import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { InstagramService } from './instagram.service';
import { InstagramRepository } from './repositories/instagram.repository';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { InstagramApiException } from './helpers/instagram-api.exception';
import { StickerDto } from './helpers/create-content.dto';
import { MediaType } from '../../common/enums/media-type.enum';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../user-management/tenant.service';
import { InstagramAccount } from '../entities/instagram-entities/instagram-account.entity';
import { SocialAccount } from '../entities/notifications/entity/social-account.entity';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InstagramService', () => {
  let service: InstagramService;
  let instagramRepoMock: jest.Mocked<InstagramRepository>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let mediaStorageServiceMock: jest.Mocked<MediaStorageService>;
  let loggerMock: jest.Mocked<PinoLogger>;
  let tenantServiceMock: jest.Mocked<TenantService>;

  const mockTenantId = 'test-tenant-id';
  const mockUserId = 'clerk-user-id-123'; // Represents Clerk User ID
  const mockAccountId = 'ig-db-account-id-456'; // Represents InstagramAccount entity ID in DB
  const mockIgPlatformUserId = 'ig-platform-user-id-789'; // Instagram's own user ID for the account
  const mockAccessToken = 'test-access-token';
  const mockRefreshToken = 'test-refresh-token';
  const mockMediaContainerId = 'test-media-container-id';
  const mockMediaUrl = 'https://example.com/image.jpg';

  const mockSocialAccount = {
    id: 'social-account-id-1',
    userId: mockUserId,
    platformUserId: mockIgPlatformUserId,
    accessToken: mockAccessToken,
    refreshToken: mockRefreshToken,
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  } as SocialAccount;

  const mockInstagramAccountEntity = {
    id: mockAccountId,
    instagramAccountId: mockIgPlatformUserId,
    username: 'test_instagram',
    tenantId: mockTenantId,
    metadata: {
      profilePictureUrl: 'http://example.com/profile.jpg',
      instagramAccounts: [ // This structure might be from an older version or specific use case
        { id: mockIgPlatformUserId, username: 'test_instagram', pageId: 'test-page-id' },
      ],
    },
    socialAccount: mockSocialAccount,
  } as unknown as InstagramAccount; // Cast to satisfy type, ensure all required fields are mocked if used

  beforeEach(async () => {
    const mockInstagramRepoProvider = {
      getAccountByUserId: jest.fn(),
      checkRateLimit: jest.fn().mockResolvedValue(true), // Default to allow
      recordRateLimitUsage: jest.fn().mockResolvedValue(undefined),
      createPost: jest.fn(),
      deleteAccount: jest.fn().mockResolvedValue(undefined),
      // Add other methods used by InstagramService if any
    };

    const mockConfigServiceProvider = {
      get: jest.fn((key: string) => {
        const configValues = {
          'INSTAGRAM_APP_ID': 'test-app-id', // Updated key based on service usage
          'INSTAGRAM_APP_SECRET': 'test-app-secret', // Updated key
          'INSTAGRAM_API_VERSION': 'v18.0',
          'INSTAGRAM_GRAPH_API_URL': 'https://graph.facebook.com',
        };
        return configValues[key];
      }),
    };

    const mockMediaStorageServiceProvider = {
      uploadPostMedia: jest.fn(),
      uploadMediaFromUrl: jest.fn(),
    };

    const mockTenantServiceProvider = {
      getTenantId: jest.fn().mockReturnValue(mockTenantId),
      setTenantId: jest.fn(),
    };
    
    const mockPinoLoggerProvider = {
      info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), setContext: jest.fn(), child: jest.fn().mockReturnThis(), trace: jest.fn(), fatal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        { provide: InstagramRepository, useValue: mockInstagramRepoProvider },
        { provide: ConfigService, useValue: mockConfigServiceProvider },
        { provide: MediaStorageService, useValue: mockMediaStorageServiceProvider },
        { provide: TenantService, useValue: mockTenantServiceProvider },
        { provide: PinoLogger, useValue: mockPinoLoggerProvider },
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
    instagramRepoMock = module.get(InstagramRepository);
    configServiceMock = module.get(ConfigService);
    mediaStorageServiceMock = module.get(MediaStorageService);
    loggerMock = module.get(PinoLogger);
    tenantServiceMock = module.get(TenantService);

    // Default mock implementations that can be overridden in specific tests
    instagramRepoMock.getAccountByUserId.mockResolvedValue(mockInstagramAccountEntity); 
    mockedAxios.get.mockResolvedValue({ data: {} }); 
    mockedAxios.post.mockResolvedValue({ data: {} }); 
    mockedAxios.head.mockResolvedValue({ headers: { 'content-type': 'image/jpeg', 'content-length': '1000' }});
    mediaStorageServiceMock.uploadPostMedia.mockResolvedValue([{ url: 'http://example.com/uploaded.jpg' } as any]);
    mediaStorageServiceMock.uploadMediaFromUrl.mockResolvedValue({ url: 'http://example.com/uploaded_from_url.jpg' } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccountsByUserId', () => {
    it('should return Instagram account if found by repository', async () => {
      const result = await service.getAccountsByUserId(mockUserId); // Pass Clerk User ID
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockInstagramAccountEntity);
    });

    it('should return null if repository returns null (account not found)', async () => {
      instagramRepoMock.getAccountByUserId.mockResolvedValue(null);
      const result = await service.getAccountsByUserId(mockUserId);
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toBeNull();
    });
  });
  
  describe('getUserAccounts', () => {
    it('should return transformed Instagram account details if account exists', async () => {
      const result = await service.getUserAccounts(mockUserId);
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual([{
        id: mockInstagramAccountEntity.id,
        platformId: mockInstagramAccountEntity.instagramAccountId,
        name: mockInstagramAccountEntity.username,
        profilePictureUrl: mockInstagramAccountEntity.metadata?.profilePictureUrl,
        platform: 'INSTAGRAM',
        status: 'ACTIVE', 
        tokenExpiresAt: mockInstagramAccountEntity.socialAccount.tokenExpiresAt,
      }]);
    });

    it('should throw NotFoundException if instagramRepo.getAccountByUserId returns null', async () => {
      instagramRepoMock.getAccountByUserId.mockResolvedValue(null);
      await expect(service.getUserAccounts(mockUserId)).rejects.toThrow(
        new NotFoundException('No Instagram accounts found for user')
      );
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getAccountInsights', () => {
    it('should retrieve account insights if account exists', async () => {
      const mockInsightsResponse = {
        data: { data: [ { name: 'follower_count', values: [{ value: 5000 }] }, { name: 'impressions', values: [{ value: 25000 }] }, { name: 'profile_views', values: [{ value: 1500 }] }, { name: 'reach', values: [{ value: 20000 }] }, ], },
      };
      mockedAxios.get.mockResolvedValue(mockInsightsResponse);
      const result = await service.getAccountInsights(mockAccountId); // mockAccountId is DB ID
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId); // Service uses accountId (db id) to fetch from repo
      expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining(`/${mockIgPlatformUserId}/insights`), expect.any(Object));
      expect(result.followerCount).toBe(5000);
    });

    it('should throw HttpException if account not found for insights', async () => {
      instagramRepoMock.getAccountByUserId.mockResolvedValue(null);
      await expect(service.getAccountInsights(mockAccountId)).rejects.toThrow(
        new HttpException('Failed to fetch account insights', HttpStatus.NOT_FOUND)
      );
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('createStory', () => {
    it('should create an Instagram story if account exists', async () => {
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('/media')) return Promise.resolve({ data: { id: mockMediaContainerId } });
        if (url.includes('/media_configure_to_story')) return Promise.resolve({ data: { id: 'story-123' } });
        return Promise.resolve({ data: {} });
      });
      mockedAxios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } }); // Media status check

      const result = await service.createStory(mockAccountId, mockMediaUrl, []);
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // media upload and configure_to_story
      expect(result).toEqual({ platformPostId: mockMediaContainerId, postedAt: expect.any(Date) });
    });

    it('should throw HttpException if account not found for createStory', async () => {
      instagramRepoMock.getAccountByUserId.mockResolvedValue(null);
      await expect(service.createStory(mockAccountId, mockMediaUrl)).rejects.toThrow(
        new HttpException('Failed to create Instagram story', HttpStatus.NOT_FOUND)
      );
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId);
    });
  });

  describe('revokeAccess', () => {
    it('should revoke access and delete account if account exists', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } }); // Mock revoke API call
      await service.revokeAccess(mockAccountId); // mockAccountId is DB ID
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/${mockIgPlatformUserId}/permissions`), null, expect.any(Object)
      );
      expect(instagramRepoMock.deleteAccount).toHaveBeenCalledWith(mockAccountId);
    });
    
    it('should throw NotFoundException if account not found for revokeAccess', async () => {
      instagramRepoMock.getAccountByUserId.mockResolvedValue(null);
      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(NotFoundException);
      expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId);
    });
  });
  
  // Placeholder for withRateLimit if it's public or needs direct testing
  describe('withRateLimit', () => {
    it('should execute callback if rate limit not exceeded', async () => {
      const action = 'API_CALLS';
      const mockCallback = jest.fn().mockResolvedValue('result');
      // instagramRepo.checkRateLimit is already mocked to return true by default
      const result = await service.withRateLimit(mockAccountId, action, mockCallback);
      expect(instagramRepoMock.checkRateLimit).toHaveBeenCalledWith(mockAccountId, action);
      expect(mockCallback).toHaveBeenCalled();
      expect(instagramRepoMock.recordRateLimitUsage).toHaveBeenCalledWith(mockAccountId, action);
      expect(result).toBe('result');
    });

    it('should throw HttpException if rate limit exceeded', async () => {
      const action = 'API_CALLS';
      const mockCallback = jest.fn();
      instagramRepoMock.checkRateLimit.mockResolvedValue(false); // Simulate rate limit exceeded
      await expect(service.withRateLimit(mockAccountId, action, mockCallback)).rejects.toThrow(
        new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  // Placeholder for other private methods if direct testing was desired (generally not recommended)
  // For example: downloadAndValidateMedia, getInstagramAccounts, checkMediaStatus, createMediaContainer, getInsightValue

  // Example for a method that uses the accountId from the InstagramAccount entity (which is the DB ID)
  describe('post (example of method using accountId as DB ID)', () => {
    it('should make a post if account exists', async () => {
        // Assume post method fetches account by its DB ID (mockAccountId)
        // instagramRepoMock.getAccountByUserId.mockResolvedValue(mockInstagramAccountEntity); already default
        mockedAxios.post.mockImplementation((url) => {
            if (url.includes(`${mockIgPlatformUserId}/media`)) return Promise.resolve({ data: { id: 'container_id' } });
            if (url.includes(`${mockIgPlatformUserId}/media_publish`)) return Promise.resolve({ data: { id: 'published_media_id' } });
            return Promise.reject(new Error('Unexpected POST URL'));
        });
        mockedAxios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } }); // For status check

        const postData = { accountId: mockAccountId, mediaItems: [{ url: mockMediaUrl }], caption: 'Test caption' };
        const result = await service.post(postData.accountId, postData.mediaItems, postData.caption);
        
        expect(instagramRepoMock.getAccountByUserId).toHaveBeenCalledWith(mockAccountId);
        expect(mockedAxios.post).toHaveBeenCalledTimes(2); // media container + media_publish
        expect(result.platformPostId).toBe('published_media_id');
    });

    it('should throw NotFoundException if account not found for post', async () => {
        instagramRepoMock.getAccountByUserId.mockResolvedValue(null);
        const postData = { accountId: mockAccountId, mediaItems: [{ url: mockMediaUrl }], caption: 'Test caption' };
        await expect(service.post(postData.accountId, postData.mediaItems, postData.caption))
            .rejects.toThrow(new HttpException('Account not found', HttpStatus.NOT_FOUND));
    });
  });
});
