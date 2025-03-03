export interface FacebookPageMetrics {
  impressions: number;
  engagedUsers: number;
  newFans: number;
  pageViews: number;
  engagements: number;
  followers: number;
  collectedAt: Date;
}

export interface FacebookPostMetrics {
  impressions: number;
  engagedUsers: number;
  reactions: number;
  clicks: number;
  videoViews: number;
  videoViewTime: number;
  collectedAt: Date;
}
