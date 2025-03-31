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

export interface PageInsightsResult {
  period: string;
  collected_at: string;
  metrics: Record<
    string,
    {
      name: string;
      description: string;
      current_value: number;
      previous_value: number;
      trend_percentage: number;
      values: { end_time: string; value: number }[];
    }
  >;
  summary: {
    impressions: number;
    engagement: number;
    new_likes: number;
    page_views: number;
    new_followers: number;
  };
}
