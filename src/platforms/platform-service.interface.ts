import { IsOptional, IsString } from 'class-validator';
import { MediaType } from '../common/enums/media-type.enum';

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
  accessToken?: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
  userId?: string; // Facebook/Instagram
  openId?: string; // TikTok
}

export class MediaItem {
  @IsOptional()
  @IsString()
  type?: MediaType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  file?: Express.Multer.File; // Buffer for direct uploads, string for URLs

  @IsOptional()
  @IsString()
  s3Key?: string; // For files already uploaded to S3 via presigned URL

  @IsOptional()
  @IsString()
  s3Bucket?: string; // Bucket where file was uploaded

  @IsOptional()
  @IsString()
  contentType?: string; // MIME type of the uploaded file
}
