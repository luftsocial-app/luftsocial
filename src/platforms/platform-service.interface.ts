import { IsOptional, IsString, IsUrl } from 'class-validator';

export interface PostResponse {
  platformPostId: string;
  postedAt: Date;
  metrics?: Record<string, any>;
}

export interface CommentResponse {
  items: Array<{
    id: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
  }>;
  nextPageToken?: string;
}

export interface PlatformService {
  getPostMetrics(
    accountId: string,
    postId: string,
  ): Promise<Record<string, any>>;
}

export interface SocialAccountDetails {
  id: string;
  name: string;
  type: string;
  avatarUrl?: string;
  platformSpecific?: any;
}

export interface PlatformOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenHost: string;
  tokenPath: string;
  authorizePath: string;
  revokePath: string;
  scopes: string[];
  cacheOptions: {
    tokenTTL: number;
    refreshTokenTTL: number;
  };
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
  userId?: string; // Facebook/Instagram
  openId?: string; // TikTok
}

export class MediaItem {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  file?: Express.Multer.File;
}
