import { ConfigService } from '@nestjs/config';
import { PlatformOAuthConfig } from '../../platforms/platform-service.interface';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { FACEBOOK_SCOPES } from 'src/common/enums/scopes.enum';

export const PlatformConfigsProvider = {
  provide: 'PLATFORM_CONFIGS',
  useFactory: (
    configService: ConfigService,
  ): Record<SocialPlatform, PlatformOAuthConfig> => ({
    [SocialPlatform.FACEBOOK]: {
      clientId: configService.get('FACEBOOK_CLIENT_ID'),
      clientSecret: configService.get('FACEBOOK_CLIENT_SECRET'),
      redirectUri: configService.get('FACEBOOK_REDIRECT_URI'),
      tokenHost: 'https://www.facebook.com',
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
    [SocialPlatform.INSTAGRAM]: {
      clientId: configService.get('INSTAGRAM_CLIENT_ID'),
      clientSecret: configService.get('INSTAGRAM_CLIENT_SECRET'),
      redirectUri: configService.get('INSTAGRAM_REDIRECT_URI'),
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
      tokenHost: 'https://open.tiktokapis.com',
      tokenPath: '/v2/oauth2/token/',
      authorizePath: '/v2/oauth2/authorize/',
      revokePath: '/v2/oauth/revoke/',
      scopes: ['user.info.basic', 'video.list', 'video.publish'],
      cacheOptions: {
        tokenTTL: 3600,
        refreshTokenTTL: 7200,
      },
    },
  }),
  inject: [ConfigService],
};
