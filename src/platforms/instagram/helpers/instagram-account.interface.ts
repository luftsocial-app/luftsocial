import { MediaType } from '../../../common/enums/media-type.enum';
import { TokenResponse } from '../../../platforms/platform-service.interface';

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
