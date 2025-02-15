export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string[];
}

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
  authorize(userId: string): Promise<string>;
  handleCallback(
    code: string,
    state: string,
    userId: string,
  ): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  getPostMetrics(
    accountId: string,
    postId: string,
  ): Promise<Record<string, any>>;
}
