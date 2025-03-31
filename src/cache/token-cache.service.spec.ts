import { Test, TestingModule } from '@nestjs/testing';
import { TokenCacheService } from './token-cache.service';

describe('TokenCacheService', () => {
  let service: TokenCacheService;

  // Create Redis client mock without any implementation
  const mockRedisClient = {
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    secondary: mockRedisClient,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCacheService,
        {
          provide: 'CACHE_INSTANCE',
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<TokenCacheService>(TokenCacheService);

    jest.spyOn(service as any, 'storeStateInFile').mockImplementation(() => {});
    jest.spyOn(service as any, 'getStateFromFile').mockReturnValue(null);
    jest
      .spyOn(service as any, 'removeStateFromFile')
      .mockImplementation(() => {});

    if (service['logger']) {
      jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
      jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
    }

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStoredState', () => {
    it('should call cache.get with the correctly formatted key', async () => {
      const state = 'test_state';
      const mockData = { redirect: '/dashboard' };
      mockCache.get.mockResolvedValue(mockData);

      const result = await service.getStoredState(state);

      expect(mockCache.get).toHaveBeenCalledWith(`oauth_state:${state}`);
      expect(result).toEqual(mockData);
    });
  });

  describe('storeState', () => {
    it('should call cache.set with the correctly formatted key and TTL', async () => {
      // Arrange
      const state = 'test_state';
      const data = { redirect: '/dashboard' };
      mockCache.set.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(data);

      // Act
      await service.storeState(state, data);

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        data,
        expect.any(String),
      );
    });
  });

  describe('integration scenarios', () => {
    it('should store and retrieve OAuth state', async () => {
      // Arrange
      const state = 'test_state';
      const data = { redirect: '/dashboard' };
      mockCache.set.mockResolvedValue(undefined);

      // For the first get in storeState verification
      mockCache.get.mockResolvedValueOnce(data);

      // For the getStoredState call
      mockCache.get.mockResolvedValueOnce(data);

      await service.storeState(state, data);

      const result = await service.getStoredState(state);

      expect(result).toEqual(data);
    });
  });
});
