import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { FacebookService } from 'src/platforms/facebook/facebook.service';
import { InstagramService } from 'src/platforms/instagram/instagram.service';
import { LinkedInService } from 'src/platforms/linkedin/linkedin.service';
import { TikTokService } from 'src/platforms/tiktok/tiktok.service';
import { Repository } from 'typeorm';
import {
  ContentPerformance,
  PlatformAnalytics,
  PlatformMetrics,
  PostMetrics,
} from '../helpers/cross-platform.interface';
import { AnalyticsRecord } from '../entity/analytics.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsRecord)
    private readonly analyticsRepo: Repository<AnalyticsRecord>,
    private readonly facebookService: FacebookService,
    private readonly instagramService: InstagramService,
    private readonly linkedinService: LinkedInService,
    private readonly tiktokService: TikTokService,
  ) {}

  async getAccountAnalytics(params: {
    userId: string;
    platforms: {
      platform: SocialPlatform;
      accountId: string;
    }[];
    dateRange: {
      start: Date;
      end: Date;
    };
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
    dateRange: { start: Date; end: Date },
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
    accountId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<PlatformMetrics> {
    const metrics = await this.facebookService.getMetrics(accountId);
    return {
      followers: metrics.followers_count,
      engagement: metrics.engagement_rate,
      impressions: metrics.impressions,
      reach: metrics.reach,
      posts: metrics.posts_count,
      platformSpecific: {
        pageViews: metrics.page_views,
        reactions: metrics.reactions,
        shares: metrics.shares,
      },
    };
  }

  private async getInstagramAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<PlatformMetrics> {
    const metrics = await this.instagramService.getMetrics(accountId);
    return {
      followers: metrics.followers_count,
      engagement: metrics.engagement_rate,
      impressions: metrics.impressions,
      reach: metrics.reach,
      posts: metrics.media_count,
      platformSpecific: {
        stories: metrics.stories_count,
        profileVisits: metrics.profile_views,
        saves: metrics.saves,
      },
    };
  }

  private async getLinkedInAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<PlatformMetrics> {
    const metrics = await this.linkedinService.getAccountMetrics(accountId);
    return {
      followers: metrics.followers_count,
      engagement: metrics.engagement_rate,
      impressions: metrics.impressions,
      reach: metrics.unique_impressions,
      posts: metrics.posts_count,
      platformSpecific: {
        clicks: metrics.clicks,
        shares: metrics.shares,
        comments: metrics.comments,
      },
    };
  }

  private async getTikTokAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<PlatformMetrics> {
    const metrics = await this.tiktokService.getAccountMetrics(accountId);
    return {
      followers: metrics.followers_count,
      engagement: metrics.engagement_rate,
      impressions: metrics.video_views,
      reach: metrics.reach,
      posts: metrics.video_count,
      platformSpecific: {
        likes: metrics.likes_count,
        shares: metrics.shares_count,
        comments: metrics.comments_count,
      },
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
          const metrics = await this.getPostMetrics(platform, postId);
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
