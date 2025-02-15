import { SocialPlatform } from 'src/enum/social-platform.enum';

export interface ConnectedPlatform {
  platform: SocialPlatform;
  accounts: {
    id: string;
    name: string;
    type: string;
  }[];
}

export enum PublishStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
}

export interface PublishResult {
  publishId: string;
  status: PublishStatus;
  results: any[];
}

export interface PlatformAnalytics {
  platform: SocialPlatform;
  accountId: string;
  metrics?: PlatformMetrics;
  error?: string;
  success: boolean;
}

export interface PlatformMetrics {
  followers: number;
  engagement: number;
  impressions: number;
  reach: number;
  posts: number;
  platformSpecific: any;
}

export interface PostMetrics {
  engagement: number;
  impressions: number;
  reach: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  platformSpecific: any;
}

export interface ContentPerformance {
  platform: SocialPlatform;
  postId: string;
  metrics?: PostMetrics;
  error?: string;
  success: boolean;
}

export enum ScheduleStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  PARTIALLY_PUBLISHED = 'PARTIALLY_PUBLISHED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
