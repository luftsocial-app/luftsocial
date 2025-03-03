import { Test, TestingModule } from '@nestjs/testing';
import { TokenCacheService } from './token-cache.service';
import { ConfigService } from '@nestjs/config';

describe('TokenCacheService', () => {
  let service: TokenCacheService;

  // Mock the Cacheable instance
  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  // Mock ConfigService
  const mockConfigService = {
    get: jest.fn((key) => {
      // Return test values for configs
      const configMap = {
        'cache.ttl.oauth_state': 600,
        'cache.ttl.access_token': 3600,
        'cache.ttl.refresh_token': 7200,
      };
      return configMap[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCacheService,
        {
          provide: 'CACHE_INSTANCE',
          useValue: mockCache,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenCacheService>(TokenCacheService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getToken', () => {
    it('should return null when token is not found', async () => {
      const key = 'nonexistent_key';

      mockCache.get.mockResolvedValue(null);

      const result = await service.getToken(key);

      expect(mockCache.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should handle errors from cache instance', async () => {
      const key = 'error_key';
      const error = new Error('Cache error');

      mockCache.get.mockRejectedValue(error);

      await expect(service.getToken(key)).rejects.toThrow('Cache error');
      expect(mockCache.get).toHaveBeenCalledWith(key);
    });
  });

  describe('setToken', () => {
    it('should call cache.set with correct parameters including ttl', async () => {
      const key = 'test_key';
      const token = { access_token: 'abc123', expires_in: 3600 };
      const ttl = '3600s';

      await service.setToken(key, token, ttl);

      expect(mockCache.set).toHaveBeenCalledWith(key, token, ttl);
    });

    it('should use configured TTL for access tokens when ttl not provided', async () => {
      const key = 'access_token:google:user123';
      const token = { access_token: 'abc123', expires_in: 3600 };

      await service.setToken(key, token);

      expect(mockCache.set).toHaveBeenCalledWith(key, token, '3600s');
    });

    it('should use configured TTL for refresh tokens when ttl not provided', async () => {
      const key = 'refresh_token:facebook:user456';
      const token = { refresh_token: 'xyz789' };

      await service.setToken(key, token);

      expect(mockCache.set).toHaveBeenCalledWith(key, token, '604800s');
    });
  });

  describe('deleteToken', () => {
    it('should call cache.delete with the correct key', async () => {
      const key = 'test_key';

      await service.deleteToken(key);

      expect(mockCache.delete).toHaveBeenCalledWith(key);
    });

    it('should handle errors from cache instance', async () => {
      const key = 'error_key';
      const error = new Error('Original error');

      mockCache.delete.mockRejectedValue(error);

      await expect(service.deleteToken(key)).rejects.toThrow(
        'Cache delete error: Original error',
      );
      expect(mockCache.delete).toHaveBeenCalledWith(key);
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
    it('should call cache.get with the correctly formatted key', async () => {
      const state = 'random_state_123';
      const mockStateData = { redirect: '/dashboard', userId: '123' };

      mockCache.get.mockResolvedValue(mockStateData);

      const result = await service.getStoredState(state);

      expect(mockCache.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(result).toEqual(mockStateData);
    });

    it('should return null when state is not found', async () => {
      const state = 'nonexistent_state';

      mockCache.get.mockResolvedValue(null);

      const result = await service.getStoredState(state);

      expect(mockCache.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(result).toBeNull();
    });

    it('should handle errors from cache instance', async () => {
      const state = 'error_state';
      const error = new Error('Cache error');

      mockCache.get.mockRejectedValue(error);

      await expect(service.getStoredState(state)).rejects.toThrow(
        'Cache error',
      );
      expect(mockCache.get).toHaveBeenCalledWith(`oauth_state:${state}`);
    });
  });

  describe('storeState', () => {
    it('should call cache.set with the correctly formatted key and TTL', async () => {
      const state = 'random_state_123';
      const data = { redirect: '/dashboard', userId: '123' };

      await service.storeState(state, data);

      expect(mockCache.set).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        data,
        '600s',
      );
    });

    it('should handle errors from cache instance', async () => {
      const state = 'error_state';
      const data = { redirect: '/home' };
      const error = new Error('Cache set error');

      mockCache.set.mockRejectedValue(error);

      await expect(service.storeState(state, data)).rejects.toThrow(
        'Cache set error',
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        data,
        '600s',
      );
    });
  });

  describe('integration scenarios', () => {
    it('should store and retrieve a token using generated key', async () => {
      const platform = 'github';
      const identifier = 'dev456';
      const token = { access_token: 'xyz789', expires_in: 7200 };
      const ttl = '7200s';

      // Generate key for access token
      const key = service.generateKey('access', platform, identifier);
      expect(key).toBe('access_token:github:dev456');

      // Store token with the generated key
      mockCache.set.mockResolvedValue(undefined);
      await service.setToken(key, token, ttl);
      expect(mockCache.set).toHaveBeenCalledWith(key, token, ttl);

      // Retrieve token with the same key
      mockCache.get.mockResolvedValue(token);
      const retrievedToken = await service.getToken(key);
      expect(mockCache.get).toHaveBeenCalledWith(key);
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
      mockCache.set.mockResolvedValue(undefined);
      await service.storeState(state, stateData);
      expect(mockCache.set).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        stateData,
        '600s',
      );

      // Retrieve state
      mockCache.get.mockResolvedValue(stateData);
      const retrievedState = await service.getStoredState(state);
      expect(mockCache.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(retrievedState).toEqual(stateData);
    });
  });
});
