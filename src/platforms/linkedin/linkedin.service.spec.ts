import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import * as config from 'config';
import { LinkedInService } from './linkedin.service';
import { LinkedInRepository } from './repositories/linkedin.repository';
import { TenantService } from '../../database/tenant.service';
import { MediaStorageService } from '../../asset-management/media-storage/media-storage.service';
import { LinkedInApiException } from './helpers/linkedin-api.exception';
import { MediaItem } from '../platform-service.interface';
import { DateRange } from '../../cross-platform/helpers/cross-platform.interface';
import { CreateLinkedInPostDto } from './helpers/create-post.dto';

jest.mock('axios');
jest.mock('config', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'LINKEDIN_CLIENT_ID') return 'mock_client_id';
    if (key === 'LINKEDIN_CLIENT_SECRET') return 'mock_client_secret';
    return null;
  }),
}));

describe('LinkedInService', () => {
  let service: LinkedInService;
  let linkedInRepo: jest.Mocked<LinkedInRepository>;
  let tenantService: jest.Mocked<TenantService>;
  let mediaStorageService: jest.Mocked<MediaStorageService>;
  let mockedAxios;

  // Mock data
  const mockTenantId = 'tenant123';
  const mockUserId = 'user123';
  const mockAccountId = 'account123';
  const mockPostId = 'post123';
  const mockAccessToken = 'access_token_123';
  const mockRefreshToken = 'refresh_token_123';
  const mockOrganizationId = 'org123';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    linkedinUserId: mockUserId,
    socialAccount: {
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresAt: new Date(),
    },
    organizations: [mockOrganizationId],
    metadata: {
      organizations: [{ id: mockOrganizationId, name: 'Test Organization' }],
    },
  };

  const mockDateRange: DateRange = {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'),
  };

  const mockFile = {
    fieldname: 'file',
    originalname: 'image.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
  } as Express.Multer.File;

  const mockMediaItem: MediaItem = {
    file: mockFile,
    url: undefined,
    description: 'Test image',
  };

  const mockMediaUrlItem: MediaItem = {
    file: undefined,
    url: 'https://example.com/image.jpg',
    description: 'Test image URL',
  };

  const mockUploadedMedia = {
    id: 'media123',
    url: 'https://cdn.example.com/image.jpg',
    mimeType: 'image/jpeg',
    fileName: 'image.jpg',
    size: 1024,
  };

  const mockCreatePostDto: CreateLinkedInPostDto = {
    content: 'Test post content',
    visibility: 'PUBLIC',
  };

  beforeEach(async () => {
    // Create mock implementations
    const mockLinkedInRepo = {
      setTenantId: jest.fn(),
      getById: jest.fn().mockResolvedValue(mockAccount),
      createPost: jest.fn().mockResolvedValue({}),
      upsertOrganization: jest.fn().mockImplementation((org) => org),
      deleteAccount: jest.fn().mockResolvedValue({}),
    };

    const mockTenantService = {
      getTenantId: jest.fn().mockReturnValue(mockTenantId),
    };

    const mockMediaStorageService = {
      uploadPostMedia: jest.fn().mockResolvedValue([mockUploadedMedia]),
      uploadMediaFromUrl: jest.fn().mockResolvedValue(mockUploadedMedia),
    };

    // Setup test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedInService,
        {
          provide: LinkedInRepository,
          useValue: mockLinkedInRepo,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: MediaStorageService,
          useValue: mockMediaStorageService,
        },
      ],
    }).compile();

    service = module.get<LinkedInService>(LinkedInService);
    linkedInRepo = module.get(
      LinkedInRepository,
    ) as jest.Mocked<LinkedInRepository>;
    tenantService = module.get(TenantService) as jest.Mocked<TenantService>;
    mediaStorageService = module.get(
      MediaStorageService,
    ) as jest.Mocked<MediaStorageService>;

    // Mock axios
    mockedAxios = axios as jest.Mocked<typeof axios>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccountsByUserId', () => {
    it('should return LinkedIn account for a user', async () => {
      const result = await service.getAccountsByUserId(mockUserId);

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(linkedInRepo.setTenantId).toHaveBeenCalledWith(mockTenantId);
      expect(linkedInRepo.getById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockAccount);
    });

    it('should handle errors when fetching accounts', async () => {
      linkedInRepo.getById.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getAccountsByUserId(mockUserId);

      expect(result).toBeUndefined();
    });
  });

  describe('getUserAccounts', () => {
    it('should throw NotFoundException when no accounts found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(service.getUserAccounts(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user accounts from LinkedIn API', async () => {
      const mockOrganizationAcls = {
        data: {
          elements: [
            { organization: 'urn:li:organization:org123' },
            { organization: 'urn:li:organization:org456' },
          ],
        },
      };

      const mockOrgDetails = [
        {
          data: {
            id: 'org123',
            localizedName: 'Organization 1',
            vanityName: 'org1',
            logoV2: { original: 'https://example.com/logo1.jpg' },
            locations: [{ country: 'US' }],
          },
        },
        {
          data: {
            id: 'org456',
            localizedName: 'Organization 2',
            vanityName: 'org2',
            logoV2: { original: 'https://example.com/logo2.jpg' },
            locations: [{ country: 'UK' }],
          },
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce(mockOrganizationAcls)
        .mockResolvedValueOnce(mockOrgDetails[0])
        .mockResolvedValueOnce(mockOrgDetails[1]);

      const result = await service.getUserAccounts(mockUserId);

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'org123',
        name: 'Organization 1',
        type: 'organization',
        avatarUrl: 'https://example.com/logo1.jpg',
        platformSpecific: {
          vanityName: 'org1',
          locations: [{ country: 'US' }],
        },
      });
    });

    it('should throw LinkedInApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(service.getUserAccounts(mockUserId)).rejects.toThrow(
        LinkedInApiException,
      );
    });
  });

  describe('post', () => {
    it('should throw HttpException when account not found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.post(mockAccountId, mockCreatePostDto),
      ).rejects.toThrow(HttpException);
    });

    it('should post content to LinkedIn without media', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: mockPostId },
      });

      const result = await service.post(mockAccountId, mockCreatePostDto);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.linkedin.com/rest/posts',
        {
          author: `urn:li:organization:${mockOrganizationId}`,
          commentary: mockCreatePostDto.content,
          visibility: mockCreatePostDto.visibility,
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
        },
        expect.any(Object),
      );

      expect(linkedInRepo.createPost).toHaveBeenCalled();
      expect(result).toEqual({
        platformPostId: mockPostId,
        postedAt: expect.any(Date),
      });
    });

    it('should post content with media to LinkedIn', async () => {
      // Mock the uploadMedia private method
      mockedAxios.post
        .mockResolvedValueOnce({
          // Register upload response
          data: {
            value: {
              asset: 'urn:li:asset:123',
              uploadMechanism: {
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                  uploadUrl: 'https://api.linkedin.com/upload',
                },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          // Post creation response
          data: { id: mockPostId },
        });

      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('test image'),
        headers: { 'content-type': 'image/jpeg' },
      });

      mockedAxios.put.mockResolvedValueOnce({}); // Upload media response

      const result = await service.post(mockAccountId, mockCreatePostDto, [
        mockMediaUrlItem,
      ]);

      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalled();
      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Register upload and create post
      expect(mockedAxios.put).toHaveBeenCalledTimes(1); // Upload media

      expect(result).toEqual({
        platformPostId: mockPostId,
        postedAt: expect.any(Date),
      });
    });

    it('should throw LinkedInApiException when post fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.post(mockAccountId, mockCreatePostDto),
      ).rejects.toThrow(LinkedInApiException);
    });
  });

  describe('getComments', () => {
    it('should throw HttpException when account not found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getComments(mockAccountId, mockPostId),
      ).rejects.toThrow(HttpException);
    });

    it('should return comments for a post', async () => {
      const mockCommentsResponse = {
        data: {
          elements: [
            {
              id: 'comment123',
              message: { text: 'Great post!' },
              actor: { name: 'John Doe' },
              created: { time: 1609459200000 }, // 2021-01-01
            },
          ],
          paging: { start: 20 },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockCommentsResponse);

      const result = await service.getComments(mockAccountId, mockPostId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://api.linkedin.com/rest/socialActions/${mockPostId}/comments`,
        expect.any(Object),
      );

      expect(result).toEqual({
        items: [
          {
            id: 'comment123',
            content: 'Great post!',
            authorId: { name: 'John Doe' },
            authorName: 'John Doe',
            createdAt: expect.any(Date),
          },
        ],
        nextPageToken: '20',
      });
    });

    it('should pass pageToken to API when provided', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { elements: [] },
      });

      await service.getComments(mockAccountId, mockPostId, '20');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            start: '20',
          }),
        }),
      );
    });

    it('should throw LinkedInApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getComments(mockAccountId, mockPostId),
      ).rejects.toThrow(LinkedInApiException);
    });
  });

  describe('getPostMetrics', () => {
    it('should throw HttpException when account not found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getPostMetrics(mockAccountId, mockPostId),
      ).rejects.toThrow(HttpException);
    });

    it('should return metrics for a post', async () => {
      const mockMetricsResponse = {
        data: {
          totalShareStatistics: {
            engagement: 0.05,
            impressionCount: 1000,
            uniqueImpressionsCount: 800,
            likeCount: 50,
            commentCount: 10,
            shareCount: 5,
            clickCount: 20,
          },
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockMetricsResponse);

      const result = await service.getPostMetrics(mockAccountId, mockPostId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.linkedin.com/rest/organizationalEntityShareStatistics',
        expect.any(Object),
      );

      expect(result).toEqual({
        engagement: 0.05,
        impressions: 1000,
        reach: 800,
        reactions: 50,
        comments: 10,
        shares: 5,
        platformSpecific: {
          clicks: 20,
          engagement_detail: {
            likes: 50,
            comments: 10,
            shares: 5,
            clicks: 20,
          },
        },
      });
    });

    it('should handle missing metrics with default values', async () => {
      const mockMetricsResponse = {
        data: {
          totalShareStatistics: {},
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockMetricsResponse);

      const result = await service.getPostMetrics(mockAccountId, mockPostId);

      expect(result).toEqual({
        engagement: 0,
        impressions: 0,
        reach: 0,
        reactions: 0,
        comments: 0,
        shares: 0,
        platformSpecific: {
          clicks: 0,
          engagement_detail: {
            likes: 0,
            comments: 0,
            shares: 0,
            clicks: 0,
          },
        },
      });
    });

    it('should throw LinkedInApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getPostMetrics(mockAccountId, mockPostId),
      ).rejects.toThrow(LinkedInApiException);
    });
  });

  describe('getAccountMetrics', () => {
    it('should throw NotFoundException when account not found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(
        service.getAccountMetrics(mockAccountId, mockDateRange),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw LinkedInApiException when no organizations found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce({
        ...mockAccount,
        organizations: [],
      });

      await expect(
        service.getAccountMetrics(mockAccountId, mockDateRange),
      ).rejects.toThrow(LinkedInApiException);
    });

    it('should return aggregated metrics for all organizations', async () => {
      const mockOrg1Metrics = {
        data: {
          followerCount: 1000,
          engagement: 0.05,
          impressionCount: 5000,
          uniqueImpressionsCount: 4000,
          shareCount: 20,
          clickCount: 100,
          likeCount: 200,
          commentCount: 50,
        },
      };

      const mockOrg2Metrics = {
        data: {
          followerCount: 2000,
          engagement: 0.08,
          impressionCount: 10000,
          uniqueImpressionsCount: 8000,
          shareCount: 30,
          clickCount: 200,
          likeCount: 400,
          commentCount: 100,
        },
      };

      // Update mock account to have two organizations
      linkedInRepo.getById.mockResolvedValueOnce({
        ...mockAccount,
        organizations: ['org123', 'org456'],
      });

      mockedAxios.get
        .mockResolvedValueOnce(mockOrg1Metrics)
        .mockResolvedValueOnce(mockOrg2Metrics);

      const result = await service.getAccountMetrics(
        mockAccountId,
        mockDateRange,
      );

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        followers: 3000,
        engagement: 0.13,
        impressions: 15000,
        reach: 12000,
        posts: 50,
        dateRange: mockDateRange,
        platformSpecific: {
          organizations: [
            {
              organizationId: 'org123',
              clickCount: 100,
              likeCount: 200,
              commentCount: 50,
              shareCount: 20,
            },
            {
              organizationId: 'org456',
              clickCount: 200,
              likeCount: 400,
              commentCount: 100,
              shareCount: 30,
            },
          ],
        },
      });
    });

    it('should throw LinkedInApiException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.getAccountMetrics(mockAccountId, mockDateRange),
      ).rejects.toThrow(LinkedInApiException);
    });
  });

  describe('getUserOrganizations', () => {
    it('should throw NotFoundException when account not found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(service.getUserOrganizations(mockAccountId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user organizations from LinkedIn API', async () => {
      const mockOrganizationsResponse = {
        data: {
          elements: [
            {
              id: 'org123',
              name: 'Organization 1',
              vanityName: 'org1',
              localizedName: 'Organization One',
              localizedDescription: 'First organization',
            },
            {
              id: 'org456',
              name: 'Organization 2',
              vanityName: 'org2',
              localizedName: 'Organization Two',
              localizedDescription: 'Second organization',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockOrganizationsResponse);

      const result = await service.getUserOrganizations(mockAccountId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.linkedin.com/organizations',
        expect.any(Object),
      );

      expect(result).toHaveLength(2);
      expect(linkedInRepo.upsertOrganization).toHaveBeenCalledTimes(2);

      expect(result[0]).toEqual({
        account: mockAccount,
        organizationId: 'org123',
        name: 'Organization One',
        vanityName: 'org1',
        description: 'First organization',
      });
    });

    it('should throw HttpException when API request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      await expect(service.getUserOrganizations(mockAccountId)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('revokeAccess', () => {
    it('should throw NotFoundException when account not found', async () => {
      linkedInRepo.getById.mockResolvedValueOnce(null);

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should revoke LinkedIn access and delete account', async () => {
      mockedAxios.post.mockResolvedValueOnce({});

      await service.revokeAccess(mockAccountId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/revoke',
        expect.any(URLSearchParams),
        expect.any(Object),
      );

      expect(linkedInRepo.deleteAccount).toHaveBeenCalledWith(mockAccountId);
    });

    it('should throw LinkedInApiException when revoke fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API error'));

      await expect(service.revokeAccess(mockAccountId)).rejects.toThrow(
        LinkedInApiException,
      );
    });
  });

  describe('uploadLinkedInMediaItemsToStorage (private method test)', () => {
    it('should return empty array when no media provided', async () => {
      // We can test this private method indirectly through the post method
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: mockPostId },
      });

      await service.post(mockAccountId, mockCreatePostDto);

      expect(mediaStorageService.uploadPostMedia).not.toHaveBeenCalled();
      expect(mediaStorageService.uploadMediaFromUrl).not.toHaveBeenCalled();
    });

    it('should handle URL uploads correctly', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: mockPostId },
      });

      await service.post(mockAccountId, mockCreatePostDto, [mockMediaUrlItem]);

      expect(mediaStorageService.uploadPostMedia).not.toHaveBeenCalled();
      expect(mediaStorageService.uploadMediaFromUrl).toHaveBeenCalled();
    });
  });
});
