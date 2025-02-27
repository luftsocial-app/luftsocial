import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { TokenCacheService } from './token-cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
          ttl: 300, // 5 minutes default
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TokenCacheService],
  exports: [NestCacheModule, TokenCacheService],
})
export class TokenCacheModule {}
