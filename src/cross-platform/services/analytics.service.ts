import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FacebookService } from '../../platforms/facebook/facebook.service';
import { InstagramService } from '../../platforms/instagram/instagram.service';
import { LinkedInService } from '../../platforms/linkedin/linkedin.service';
import { TikTokService } from '../../platforms/tiktok/tiktok.service';
import { Repository } from 'typeorm';
import {
  ContentPerformance,
  DateRange,
  PlatformAnalytics,
  PlatformMetrics,
  PostMetrics,
} from '../helpers/cross-platform.interface';
import { AnalyticsRecord } from '../../entities/cross-platform-entities/analytics.entity';
import { SocialPlatform } from '../../common/enums/social-platform.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsRecord)
    private readonly analyticsRepo: Repository<AnalyticsRecord>,
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,
  ) { }

  async getAccountAnalytics(params: {
    userId: string;
    platforms: {
      platform: SocialPlatform;
      accountId: string;
    }[];
    dateRange: DateRange;
  }): Promise<PlatformAnalytics[]> {
    const analytics = await Promise.allSettled(
      params.platforms.map(async ({ platform, accountId }) => {
        try {
          const metrics = await this.getPlatformAnalytics(
            platform,
            accountId,
            params.dateRange,
          );

          return {
            platform,
            accountId,
            metrics,
            success: true,
          };
        } catch (error) {
          return {
            platform,
            accountId,
            error: error.message,
            success: false,
          };
        }
      }),
    );

    // Store analytics record
    await this.analyticsRepo.save({
      userId: params.userId,
      dateRange: params.dateRange,
      platforms: params.platforms,
      results: analytics.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
            platform: result.reason.platform,
            accountId: result.reason.accountId,
            success: false,
            error: result.reason.message,
          },
      ),
    });

    return analytics.map((result) =>
      result.status === 'fulfilled' ? result.value : result.reason,
    );
  }

  private async getPlatformAnalytics(
    platform: SocialPlatform,
    accountId: string,
    dateRange: DateRange,
  ): Promise<PlatformMetrics> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.getFacebookAnalytics(accountId, dateRange);
      case SocialPlatform.INSTAGRAM:
        return this.getInstagramAnalytics(accountId, dateRange);
      case SocialPlatform.LINKEDIN:
        return this.getLinkedInAnalytics(accountId, dateRange);
      case SocialPlatform.TIKTOK:
        return this.getTikTokAnalytics(accountId, dateRange);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  private async getFacebookAnalytics(
    pageId: string,
    dateRange: DateRange,
  ): Promise<PlatformMetrics> {
    const metrics = await this.facebookService.getPageMetrics(
      pageId,
      dateRange,
    );
    return {
      followers: metrics.followers,
      engagement: metrics.engagement,
      impressions: metrics.impressions,
      reach: metrics.reach,
      platformSpecific: metrics.platformSpecific,
    };
  }

  private async getInstagramAnalytics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<PlatformMetrics> {
    const metrics = await this.instagramService.getAccountMetrics(
      accountId,
      dateRange,
    );
    return {
      followers: metrics.followers,
      engagement: metrics.engagement,
      impressions: metrics.impressions,
      reach: metrics.reach,
      platformSpecific: metrics.platformSpecific,
    };
  }

  private async getLinkedInAnalytics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<PlatformMetrics> {
    const metrics = await this.linkedinService.getAccountMetrics(
      accountId,
      dateRange,
    );
    return {
      followers: metrics.followers,
      engagement: metrics.engagement,
      impressions: metrics.impressions,
      reach: metrics.reach,
      posts: metrics.posts,
      platformSpecific: metrics.platformSpecific,
    };
  }

  private async getTikTokAnalytics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<PlatformMetrics> {
    const metrics = await this.tiktokService.getAccountMetrics(
      accountId,
      dateRange,
    );
    return {
      followers: metrics.followers,
      engagement: metrics.engagement,
      impressions: metrics.impressions,
      reach: metrics.reach,
      posts: metrics.posts,
      platformSpecific: metrics.platformSpecific,
    };
  }

  async getContentPerformance(params: {
    userId: string;
    postIds: {
      platform: SocialPlatform;
      postId: string;
    }[];
  }): Promise<ContentPerformance[]> {
    return Promise.all(
      params.postIds.map(async ({ platform, postId }) => {
        try {
          const metrics = await this.getPostMetrics(
            platform,
            params.userId,
            postId,
          );
          return {
            platform,
            postId,
            metrics,
            success: true,
          };
        } catch (error) {
          return {
            platform,
            postId,
            error: error.message,
            success: false,
          };
        }
      }),
    );
  }

  private async getPostMetrics(
    platform: SocialPlatform,
    accountId: string,
    postId: string,
  ): Promise<PostMetrics> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
        return this.facebookService.getPostMetrics(accountId, postId);
      case SocialPlatform.INSTAGRAM:
        return this.instagramService.getPostMetrics(accountId, postId);
      case SocialPlatform.LINKEDIN:
        return this.linkedinService.getPostMetrics(accountId, postId);
      case SocialPlatform.TIKTOK:
        return this.tiktokService.getPostMetrics(accountId, postId);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }
}
