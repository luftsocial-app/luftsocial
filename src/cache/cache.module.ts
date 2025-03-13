import { Module } from '@nestjs/common';
import { Cacheable } from 'cacheable';
import KeyvRedis from '@keyv/redis';
import * as config from 'config';
import { TokenCacheService } from './token-cache.service';

function createRedisUrl(redisConfig: any): string {
  const { host, port, username, password } = redisConfig;

  const auth =
    username && password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : '';
  console.log('auth', auth);

  return `redis://${auth}${host}:${port}`;
}

@Module({
  providers: [
    {
      provide: 'CACHE_INSTANCE',
      useFactory: () => {
        const redisConfig = config.get('cache.redis');
        const redisUrl = createRedisUrl(redisConfig);
        const defaultTtl = config.get<number>('cache.defaults.ttl');
        const secondary = new KeyvRedis(redisUrl);
        return new Cacheable({
          secondary,
          ttl: defaultTtl ? `${defaultTtl}s` : '4h',
        });
      },
    },
    TokenCacheService,
  ],
  exports: ['CACHE_INSTANCE', TokenCacheService],
})
export class CacheModule {}
