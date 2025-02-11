export interface TikTokComment {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  createdAt: Date;
}

export interface VideoMetrics {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  playCount: number;
  downloadCount: number;
  engagementRate: number;
  averageWatchTime?: number;
  totalWatchTime?: number;
  totalWatchTimeMillis?: number;
  retentionRate?: any;
  audienceTerritories?: any;
}

export interface CreateVideoParams {
  accountId: string;
  description: string;
  privacyLevel?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  disableComments?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
}

export interface TikTokVideo {
  id: string;
  platformVideoId: string;
  description: string;
  shareUrl?: string;
  thumbnailUrl?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'FAILED';
  privacyLevel: string;
  metrics?: VideoMetrics;
  createdAt: Date;
  updatedAt: Date;
}
