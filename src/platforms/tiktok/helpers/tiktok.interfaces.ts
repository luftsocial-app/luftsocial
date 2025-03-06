import { TokenResponse } from '../../../platforms/platform-service.interface';

export enum TikTokVideoPrivacyLevel {
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
}

export enum TikTokPostVideoStatus {
  'PENDING',
  'COMPLETED',
  'FAILED',
}

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
}

export interface CreateUploadSessionParams {
  accountId: string;
  publishId: string;
  uploadUrl: string;
  uploadParams: any;
  status: TikTokPostVideoStatus;
  expiresAt: Date;
}

export interface CreateVideoParams {
  publishId?: string;
  uploadUrl?: string;
  status?: TikTokPostVideoStatus;
  title?: string;
  privacyLevel: TikTokVideoPrivacyLevel;
  disableDuet?: boolean;
  disableStitch?: boolean;
  disableComment?: boolean;
  videoCoverTimestampMs?: number;
  brandContentToggle?: boolean;
  brandOrganicToggle?: boolean;
  isAigc?: boolean;
}

export interface VideoUploadInit {
  source: 'PULL_FROM_URL' | 'FILE_UPLOAD';
  videoUrl?: string;
  videoSize?: number;
  chunkSize?: number;
  totalChunkCount?: number;
}

export interface VideoUploadResponse {
  publishId: string;
  uploadUrl?: string;
}

export interface TIktokTokenResponse extends TokenResponse {
  metadata: {
    userInfo: any;
  };
}
