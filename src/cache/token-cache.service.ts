import { Inject, Injectable } from '@nestjs/common';
import * as config from 'config';
import type { Cacheable } from 'cacheable';
import * as fs from 'fs';
import * as path from 'path';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TokenCacheService {
  private stateFilePath: string;
  constructor(
    @Inject('CACHE_INSTANCE')
    private readonly cache: Cacheable,
    private readonly logger: PinoLogger,
  ) {
    // Set up file path for state storage
    this.stateFilePath = path.join(process.cwd(), '.oauth-states.json');

    // Debugging: Test Redis connection
    this.testRedisConnection();
  }

  private async testRedisConnection() {
    try {
      // Direct access to the underlying Redis client
      const redisClient = this.cache.secondary;

      // Test basic set/get
      const testKey = 'test:' + Date.now();
      const testValue = { test: true, time: new Date().toISOString() };

      this.logger.info('Testing direct Redis connection...');

      await redisClient.set(testKey, JSON.stringify(testValue));
      this.logger.info('Set operation completed');

      const retrieved = await redisClient.get(testKey);
      this.logger.info('Get operation completed');

      if (retrieved) {
        this.logger.info(
          'REDIS TEST PASSED: Successfully retrieved test value',
        );
        this.logger.info(
          'Retrieved:',
          typeof retrieved === 'string' ? JSON.parse(retrieved) : retrieved,
        );
      } else {
        this.logger.error('REDIS TEST FAILED: Could not retrieve test value');
      }
    } catch (error) {
      this.logger.error('REDIS TEST ERROR:', error);
    }
  }

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
    const key = `oauth_state:${state}`;

    // Try Redis first
    let data = await this.cache.get(key);
    this.logger.info('State retrieved from Redis:', !!data);
    this.logger.info('State key:', { key, data });

    // If not in Redis, try the file
    if (!data) {
      console.info('State not found in cache, checking backup file');
      data = this.getStateFromFile(key);
    }

    // Clean up the state after retrieval
    if (data) {
      // Clean up after successful retrieval
      await this.cache.delete(key);
      this.removeStateFromFile(key);
    }

    return data;
  }

  async storeState(state: string, data: any): Promise<void> {
    const ttl = config.get<number>('cache.ttl.oauth_state');
    const key = `oauth_state:${state}`;

    // Store in Redis
    await this.cache.set(key, data, ttl ? `${ttl}s` : '60m'); // Extended to 60 minutes

    // Also store in file as backup
    this.storeStateInFile(key, data);

    // Verify storage
    const stored = await this.cache.get(key);
    const fileStored = this.getStateFromFile(key);
    this.logger.info(`Verification - Redis storage for ${key}:`, !!stored);
    this.logger.info(`Verification - File storage for ${key}:`, !!fileStored);
  }

  // File-based backup methods
  private storeStateInFile(key: string, data: any): void {
    try {
      // Read existing states
      let states = {};
      if (fs.existsSync(this.stateFilePath)) {
        const content = fs.readFileSync(this.stateFilePath, 'utf8');
        states = JSON.parse(content);
      }

      // Add new state with expiration (1 hour)
      states[key] = {
        data,
        expires: Date.now() + 3600 * 1000,
      };

      // Write back to file
      fs.writeFileSync(this.stateFilePath, JSON.stringify(states, null, 2));
      this.logger.info(`Stored state in backup file`);
    } catch (error) {
      this.logger.error('Error storing state in file:', error);
    }
  }

  private getStateFromFile(key: string): any {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const content = fs.readFileSync(this.stateFilePath, 'utf8');
        const states = JSON.parse(content);

        if (states[key] && states[key].expires > Date.now()) {
          this.logger.info('Found state in backup file');
          return states[key].data;
        } else if (states[key]) {
          this.logger.info('Found state in backup file but it has expired');
        }
      }
      return null;
    } catch (error) {
      this.logger.error('Error reading state from file:', error);
      return null;
    }
  }

  private removeStateFromFile(key: string): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const content = fs.readFileSync(this.stateFilePath, 'utf8');
        const states = JSON.parse(content);

        if (states[key]) {
          delete states[key];
          fs.writeFileSync(this.stateFilePath, JSON.stringify(states, null, 2));
          console.info(`Removed state from backup file`);
        }
      }
    } catch (error) {
      console.error('Error removing state from file:', error);
    }
  }
}
