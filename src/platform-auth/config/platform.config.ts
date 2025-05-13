import { ConfigService } from '@nestjs/config';
import { PlatformOAuthConfig } from '../../platforms/platform-service.interface';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { FACEBOOK_SCOPES } from '../../common/enums/scopes.enum';

export const PlatformConfigsProvider = {
  provide: 'PLATFORM_CONFIGS',
  useFactory: (
    configService: ConfigService,
  ): Record<SocialPlatform, PlatformOAuthConfig> => ({
    [SocialPlatform.FACEBOOK]: {
      clientId: configService.get('platforms.facebook.FACEBOOK_CLIENT_ID'),
      clientSecret: configService.get(
        'platforms.facebook.FACEBOOK_CLIENT_SECRET',
      ),
      redirectUri: configService.get(
        'platforms.facebook.FACEBOOK_REDIRECT_URI',
      ),
      tokenHost: 'https://www.facebook.com',
      tokenPath: '/v22.0/oauth/access_token',
      authorizePath: '/v22.0/dialog/oauth',
      revokePath: '/v22.0/oauth/revoke',
      scopes: [
        FACEBOOK_SCOPES.PAGES_MANAGE_POSTS,
        FACEBOOK_SCOPES.PAGES_MANAGE_METADATA,
        FACEBOOK_SCOPES.PAGES_READ_ENGAGEMENT,
        FACEBOOK_SCOPES.PAGES_SHOW_LIST,
        FACEBOOK_SCOPES.PAGES_PUBLISH_VIDEO,
        FACEBOOK_SCOPES.PAGES_BUSINESS_MANAGEMENT,
      ],
      cacheOptions: {
        tokenTTL: 3600, // 1 hour
        refreshTokenTTL: 7200, // 2 hours
      },
    },
    [SocialPlatform.INSTAGRAM]: {
      clientId: configService.get('platforms.instagram.INSTAGRAM_CLIENT_ID'),
      clientSecret: configService.get(
        'platforms.instagram.INSTAGRAM_CLIENT_SECRET',
      ),
      redirectUri: configService.get(
        'platforms.instagram.INSTAGRAM_REDIRECT_URI',
      ),
      tokenHost: 'https://api.instagram.com',
      tokenPath: '/oauth/access_token',
      authorizePath: '/oauth/authorize',
      revokePath: '/oauth/revoke',
      scopes: ['basic', 'comments', 'relationships', 'media'],
      cacheOptions: {
        tokenTTL: 3600,
        refreshTokenTTL: 7200,
      },
    },
    [SocialPlatform.LINKEDIN]: {
      clientId: configService.get('platforms.linkedin.LINKEDIN_CLIENT_ID'),
      clientSecret: configService.get(
        'platforms.linkedin.LINKEDIN_CLIENT_SECRET',
      ),
      redirectUri: configService.get(
        'platforms.linkedin.LINKEDIN_REDIRECT_URI',
      ),
      tokenHost: 'https://www.linkedin.com',
      tokenPath: '/oauth/v2/accessToken',
      authorizePath: '/oauth/v2/authorization',
      revokePath: '/oauth/v2/revoke',
      scopes: [
        'r_liteprofile',
        'r_emailaddress',
        'w_member_social',
        'r_organization_social',
        'r_organization_administration',
        'w_organization_social',
      ],
      cacheOptions: {
        tokenTTL: 3600,
        refreshTokenTTL: 7200,
      },
    },
    [SocialPlatform.TIKTOK]: {
      clientId: configService.get('platforms.tiktok.TIKTOK_CLIENT_KEY'),
      clientSecret: configService.get('platforms.tiktok.TIKTOK_CLIENT_SECRET'),
      redirectUri: configService.get('platforms.tiktok.TIKTOK_REDIRECT_URI'),
      tokenHost: 'https://www.tiktok.com',
      tokenPath: '/v2/auth/authorize/',
      authorizePath: '/v2/auth/authorize/',
      revokePath: '/v2/oauth/revoke/',
      scopes: [
        'user.info.profile',
        // 'user.info.basic',
        // 'video.list',
        // 'video.publish',
        // 'video.upload',
      ],
      cacheOptions: {
        tokenTTL: 3600,
        refreshTokenTTL: 7200,
      },
    },
  }),
  inject: [ConfigService],
};
