import { CACHE_MANAGER } from '@nestjs/cache-manager/dist/cache.constants';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class TokenCacheService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getToken(key: string): Promise<any> {
    return this.cacheManager.get(key);
  }

  async setToken(key: string, token: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, token, ttl);
  }

  async deleteToken(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      throw new Error(`Cache delete error: ${error.message}`);
    }
  }

  generateKey(
    type: 'access' | 'refresh',
    platform: string,
    identifier: string,
  ): string {
    return `${type}_token:${platform}:${identifier}`;
  }

  async getStoredState(state: string): Promise<any> {
    return this.cacheManager.get(`oauth_state:${state}`);
  }

  async storeState(state: string, data: any): Promise<void> {
    await this.cacheManager.set(`oauth_state:${state}`, data, 600); // 10 minutes
  }
}
