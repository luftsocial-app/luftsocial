import { TokenResponse } from '../../../platforms/platform-service.interface';

export interface LinkedInOrganization {
  id: string;
  name: string;
  vanityName?: string;
  role: string;
  logoUrl?: string;
}

export interface LinkedInPost {
  id: string;
  content: string;
  mediaUrls?: string[];
  visibility: 'PUBLIC' | 'CONNECTIONS';
  organizationId: string;
}

export interface LinkedInMetrics {
  impressions: number;
  engagement: number;
  clickCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface LinkedInProfile {
  userId: string;
  linkedinUserId: string;
  firstName: string;
  lastName: string;
  email?: string;
  profileUrl?: string;
  metadata?: {
    organizations: Array<{
      id: string;
      name: string;
    }>;
  };
  socialAccount: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: Date;
  };
}

export interface LinkedInTokenResponse extends TokenResponse {
  metadata: {
    profile: LinkedInProfile;
    organizations: LinkedInOrganization[];
  };
}
