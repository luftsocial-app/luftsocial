import { ConfigService } from '@nestjs/config';
import { PlatformOAuthConfig } from '../../platforms/platform-service.interface';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import {
  FACEBOOK_SCOPES,
  INSTAGRAM_SCOPES,
} from '../../common/enums/scopes.enum';

export const PlatformConfigsProvider = {
  provide: 'PLATFORM_CONFIGS',
  useFactory: (
    configService: ConfigService,
  ): Record<SocialPlatform, PlatformOAuthConfig> => ({
    [SocialPlatform.FACEBOOK]: {
      clientId: configService.get('FACEBOOK_CLIENT_ID'),
      clientSecret: configService.get('FACEBOOK_CLIENT_SECRET'),
      redirectUri: configService.get('FACEBOOK_REDIRECT_URI'),
      tokenHost: configService.get('FACEBOOK_BASE_URL'),
      tokenPath: '/v18.0/oauth/access_token',
      authorizePath: '/v18.0/dialog/oauth',
      revokePath: '/v18.0/oauth/revoke',
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
    // Instagram with Facebook Login for Business configuration
    [SocialPlatform.INSTAGRAM]: {
      clientId: configService.get<string>('FACEBOOK_CLIENT_ID'),
      clientSecret: configService.get<string>('FACEBOOK_CLIENT_SECRET'),
      tokenHost: configService.get('FACEBOOK_BASE_URL'),
      tokenPath: '/v22.0/oauth/access_token',
      authorizePath: '/v22.0/dialog/oauth',
      revokePath: '/v22.0/auth/revoke',
      redirectUri: configService.get<string>('FACEBOOK_REDIRECT_URI'),
      scopes: [
        INSTAGRAM_SCOPES.BASIC,
        INSTAGRAM_SCOPES.CONTENT_PUBLISH,
        INSTAGRAM_SCOPES.MANAGE_COMMENTS,
        INSTAGRAM_SCOPES.MANAGE_INSIGHTS,
        INSTAGRAM_SCOPES.MANAGE_MESSAGES,
        FACEBOOK_SCOPES.PAGES_SHOW_LIST,
        FACEBOOK_SCOPES.PAGES_READ_ENGAGEMENT,
      ],
      cacheOptions: {
        tokenTTL: 60 * 60, // 1 hour
        refreshTokenTTL: 60 * 60 * 24, // 24 hours
      },
    },
    // Instagram with Business Login for Instagram configuration
    [SocialPlatform.INSTAGRAM_BUSINESS]: {
      clientId: configService.get<string>('INSTAGRAM_CLIENT_ID'),
      clientSecret: configService.get<string>('INSTAGRAM_CLIENT_SECRET'),
      tokenHost: configService.get('INSTAGRAM_BASE_URL'),
      tokenPath: '/oauth/access_token',
      authorizePath: '/oauth/authorize',
      revokePath: '/oauth/revoke',
      redirectUri: configService.get<string>('INSTAGRAM_REDIRECT_URI'),
      scopes: [
        INSTAGRAM_SCOPES.BASIC,
        INSTAGRAM_SCOPES.CONTENT_PUBLISH,
        INSTAGRAM_SCOPES.MANAGE_COMMENTS,
        INSTAGRAM_SCOPES.MANAGE_INSIGHTS,
        INSTAGRAM_SCOPES.MANAGE_MESSAGES,
      ],
      cacheOptions: {
        tokenTTL: 60 * 60, // 1 hour
        refreshTokenTTL: 60 * 60 * 24, // 24 hours
      },
    },
    [SocialPlatform.LINKEDIN]: {
      clientId: configService.get('LINKEDIN_CLIENT_ID'),
      clientSecret: configService.get('LINKEDIN_CLIENT_SECRET'),
      redirectUri: configService.get('LINKEDIN_REDIRECT_URI'),
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
      clientId: configService.get('TIKTOK_CLIENT_KEY'),
      clientSecret: configService.get('TIKTOK_CLIENT_SECRET'),
      redirectUri: configService.get('TIKTOK_REDIRECT_URI'),
      tokenHost: configService.get('TIKTOK_BASE_URL'),
      tokenPath: '/v2/auth/authorize/',
      authorizePath: '/v2/auth/authorize/',
      revokePath: '/v2/oauth/revoke/',
      baseUrl: 'https://open.tiktokapis.com/v2/',
      scopes: [
        'user.info.basic',
        'user.info.profile',
        'user.info.stats',
        'video.list',
        'video.publish',
        'video.upload',
      ],
      cacheOptions: {
        tokenTTL: 3600,
        refreshTokenTTL: 7200,
      },
    },
  }),
  inject: [ConfigService],
};
