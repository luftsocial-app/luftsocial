import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager/dist/cache.constants';
import { TokenCacheService } from './token-cache.service';
import { Cache } from 'cache-manager';

describe('TokenCacheService', () => {
  let service: TokenCacheService;
  let cacheManager: Cache;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<TokenCacheService>(TokenCacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(cacheManager).toBeDefined();
  });

  describe('getToken', () => {
    it('should return null when token is not found', async () => {
      const key = 'nonexistent_key';

      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getToken(key);

      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should handle errors from cache manager', async () => {
      const key = 'error_key';
      const error = new Error('Cache error');

      mockCacheManager.get.mockRejectedValue(error);

      await expect(service.getToken(key)).rejects.toThrow('Cache error');
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
    });
  });

  describe('setToken', () => {
    it('should call cacheManager.set with correct parameters including ttl', async () => {
      const key = 'test_key';
      const token = { access_token: 'abc123', expires_in: 3600 };
      const ttl = 3600;

      await service.setToken(key, token, ttl);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, token, ttl);
    });

    it('should call cacheManager.set without ttl if not provided', async () => {
      const key = 'test_key';
      const token = { access_token: 'abc123', expires_in: 3600 };

      await service.setToken(key, token);

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, token, undefined);
    });

    it('should handle errors from cache manager', async () => {
      const key = 'error_key';
      const token = { access_token: 'abc123' };
      const error = new Error('Cache set error');

      mockCacheManager.set.mockRejectedValue(error);

      await expect(service.setToken(key, token)).rejects.toThrow(
        'Cache set error',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, token, undefined);
    });
  });

  describe('deleteToken', () => {
    it('should call cacheManager.del with the correct key', async () => {
      const key = 'test_key';

      await service.deleteToken(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });

    it('should handle errors from cache manager', async () => {
      const key = 'error_key';
      const errorMessage = 'Cache delete error';

      mockCacheManager.del.mockRejectedValue(new Error(errorMessage));

      await expect(service.deleteToken(key)).rejects.toThrow(errorMessage);
      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });
  });

  describe('generateKey', () => {
    it('should generate correct access token key', () => {
      const type = 'access';
      const platform = 'google';
      const identifier = 'user123';

      const result = service.generateKey(type, platform, identifier);

      expect(result).toBe('access_token:google:user123');
    });

    it('should generate correct refresh token key', () => {
      const type = 'refresh';
      const platform = 'facebook';
      const identifier = 'user456';

      const result = service.generateKey(type, platform, identifier);

      expect(result).toBe('refresh_token:facebook:user456');
    });

    it('should handle different platform and identifier combinations', () => {
      const testCases = [
        {
          type: 'access',
          platform: 'twitter',
          identifier: '789',
          expected: 'access_token:twitter:789',
        },
        {
          type: 'refresh',
          platform: 'github',
          identifier: 'dev123',
          expected: 'refresh_token:github:dev123',
        },
        {
          type: 'access',
          platform: 'linkedin',
          identifier: 'user@example.com',
          expected: 'access_token:linkedin:user@example.com',
        },
      ];

      testCases.forEach(({ type, platform, identifier, expected }) => {
        const result = service.generateKey(
          type as 'access' | 'refresh',
          platform,
          identifier,
        );
        expect(result).toBe(expected);
      });
    });
  });

  describe('getStoredState', () => {
    it('should call cacheManager.get with the correctly formatted key', async () => {
      const state = 'random_state_123';
      const mockStateData = { redirect: '/dashboard', userId: '123' };

      mockCacheManager.get.mockResolvedValue(mockStateData);

      const result = await service.getStoredState(state);

      expect(mockCacheManager.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(result).toEqual(mockStateData);
    });

    it('should return null when state is not found', async () => {
      const state = 'nonexistent_state';

      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getStoredState(state);

      expect(mockCacheManager.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(result).toBeNull();
    });

    it('should handle errors from cache manager', async () => {
      const state = 'error_state';
      const error = new Error('Cache error');

      mockCacheManager.get.mockRejectedValue(error);

      await expect(service.getStoredState(state)).rejects.toThrow(
        'Cache error',
      );
      expect(mockCacheManager.get).toHaveBeenCalledWith(`oauth_state:${state}`);
    });
  });

  describe('storeState', () => {
    it('should handle errors from cache manager', async () => {
      const state = 'error_state';
      const data = { redirect: '/home' };
      const error = new Error('Cache set error');

      mockCacheManager.set.mockRejectedValue(error);

      await expect(service.storeState(state, data)).rejects.toThrow(
        'Cache set error',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        data,
        600,
      );
    });
  });

  describe('integration scenarios', () => {
    it('should store and retrieve a token using generated key', async () => {
      const platform = 'github';
      const identifier = 'dev456';
      const token = { access_token: 'xyz789', expires_in: 7200 };
      const ttl = 7200;

      // Generate key for access token
      const key = service.generateKey('access', platform, identifier);
      expect(key).toBe('access_token:github:dev456');

      // Store token with the generated key
      mockCacheManager.set.mockResolvedValue(undefined);
      await service.setToken(key, token, ttl);
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, token, ttl);

      // Retrieve token with the same key
      mockCacheManager.get.mockResolvedValue(token);
      const retrievedToken = await service.getToken(key);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(retrievedToken).toEqual(token);
    });

    it('should store and retrieve OAuth state', async () => {
      const state = 'random_state_789';
      const stateData = {
        redirect: '/settings',
        userId: '789',
        scopes: ['read', 'write'],
      };

      // Store state
      mockCacheManager.set.mockResolvedValue(undefined);
      await service.storeState(state, stateData);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        stateData,
        600,
      );

      // Retrieve state
      mockCacheManager.get.mockResolvedValue(stateData);
      const retrievedState = await service.getStoredState(state);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(retrievedState).toEqual(stateData);
    });
  });
});
