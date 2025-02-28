import { Inject, Injectable } from '@nestjs/common';
import * as config from 'config';
import type { Cacheable } from 'cacheable';

@Injectable()
export class TokenCacheService {
  constructor(
    @Inject('CACHE_INSTANCE')
    private readonly cache: Cacheable,
  ) {}

  async getToken(key: string): Promise<any> {
    return await this.cache.get(key);
  }

  async setToken(
    key: string,
    token: any,
    ttl?: number | string,
  ): Promise<void> {
    if (!ttl) {
      // Get token type from key
      const keyParts = key.split(':');
      if (keyParts.length > 0) {
        const tokenType = keyParts[0].replace('_token', '');
        const configTtl = config.get<number>(`cache.ttl.${tokenType}_token`);
        if (configTtl) {
          ttl = `${configTtl}s`;
        }
      }
    }

    await this.cache.set(key, token, ttl);
  }

  async deleteToken(key: string): Promise<void> {
    try {
      await this.cache.delete(key);
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
    return await this.cache.get(`oauth_state:${state}`);
  }

  async storeState(state: string, data: any): Promise<void> {
    const ttl = config.get<number>('cache.ttl.oauth_state');
    await this.cache.set(`oauth_state:${state}`, data, ttl ? `${ttl}s` : '10m'); // Default 10 minutes
  }
}
