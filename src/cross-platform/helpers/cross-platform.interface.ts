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
  posts?: number;
  platformSpecific: any;
}

export interface PostMetrics {
  engagement: number;
  impressions: number;
  reach?: number;
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

export interface AccountMetrics {
  followers: number;
  engagement: number;
  impressions: number;
  reach: number;
  posts?: number;
  platformSpecific: any;
  dateRange: DateRange;
}

export interface DateRange {
  startDate: string; // ISO format date string
  endDate: string; // ISO format date string
}

export interface PublishPlatformResult {
  platform: SocialPlatform;
  accountId: string;
  success: boolean;
  postId?: string;
  postedAt?: Date;
  error?: string;
}

export interface PlatformPublishResponse {
  platformPostId: string;
  postedAt: Date;
}

export interface PublishParams {
  userId: string;
  content: string;
  mediaUrls?: string[];
  platforms: {
    platform: SocialPlatform;
    accountId: string;
    platformSpecificParams?: any;
  }[];
  scheduleTime?: Date;
}

export interface PublishResult {
  publishId: string;
  status: PublishStatus;
  results: PublishPlatformResult[];
}
