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

/**
 * Generic interface for paginated API responses
 * @template T The data type contained in the response
 */
export interface PaginatedResponse<T> {
  /**
   * Array of data items
   */
  data: T[];

  /**
   * Pagination metadata
   */
  pagination: {
    /**
     * Token for retrieving the next page of results
     * Will be null if there are no more pages
     */
    nextToken: string | null;

    /**
     * Indicates if there are more pages available
     */
    hasMore: boolean;

    /**
     * Optional total count of items (may not be available for all APIs)
     */
    total?: number;

    /**
     * Optional current page number (if applicable)
     */
    page?: number;

    /**
     * Optional number of items per page (if applicable)
     */
    pageSize?: number;
  };
}
