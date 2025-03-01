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
