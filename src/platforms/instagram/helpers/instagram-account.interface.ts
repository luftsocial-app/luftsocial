import { TokenResponse } from 'src/platforms/platform-service.interface';
import { MediaType } from './media-type.enum';

export interface InstagramAccount {
  id: string;
  username: string;
  pageId: string;
  mediaCount?: number;
  followersCount?: number;
}

export interface InstagramMedia {
  id: string;
  type: MediaType;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  caption?: string;
  timestamp: Date;
}

export interface InstagramMetrics {
  engagement: number;
  impressions: number;
  reach: number;
  saved: number;
  videoViews?: number;
  carouselAlbumEngagement?: number;
  carouselAlbumImpressions?: number;
  carouselAlbumReach?: number;
  carouselAlbumSaved?: number;
  exitLinks?: number;
  profileVisits?: number;
}

export interface InstagramTokenResponse extends TokenResponse {
  metadata: {
    instagramAccounts: InstagramAccount[];
  };
}

export interface AccountInsights {
  followerCount: number;
  impressions: number;
  profileViews: number;
  reach: number;
}
