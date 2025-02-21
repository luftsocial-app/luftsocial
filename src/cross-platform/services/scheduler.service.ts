import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { SocialPlatform } from 'src/enum/social-platform.enum';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  PublishStatus,
  ScheduleStatus,
} from '../helpers/cross-platform.interface';
import { ContentPublisherService } from './content-publisher.service';
import { ScheduledPost } from '../entity/schedule.entity';

@Injectable()
export class SchedulerService {
  constructor(
    @InjectRepository(ScheduledPost)
    private readonly scheduledPostRepo: Repository<ScheduledPost>,
    private readonly contentPublisherService: ContentPublisherService,
    // private readonly logger: Logger = new Logger(SchedulerService.name),
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledPosts() {
    // this.logger.log('Processing scheduled posts');

    try {
      const pendingPosts = await this.scheduledPostRepo.find({
        where: {
          status: ScheduleStatus.PENDING,
          scheduledTime: LessThanOrEqual(new Date()),
        },
      });

      for (const post of pendingPosts) {
        try {
          // Mark as processing
          await this.scheduledPostRepo.update(post.id, {
            status: ScheduleStatus.PROCESSING,
          });

          // Publish content
          const result = await this.contentPublisherService.publishContent({
            userId: post.userId,
            content: post.content,
            mediaUrls: post.mediaUrls,
            platforms: post.platforms,
          });

          // Update status based on result
          await this.scheduledPostRepo.update(post.id, {
            status: this.mapPublishStatusToScheduleStatus(result.status),
            results: result.results,
            publishedAt: new Date(),
          });
        } catch (error) {
          await this.scheduledPostRepo.update(post.id, {
            status: ScheduleStatus.FAILED,
            error: error.message,
          });
        }
      }
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async schedulePost(params: {
    userId: string;
    content: string;
    mediaUrls?: string[];
    platforms: {
      platform: SocialPlatform;
      accountId: string;
      platformSpecificParams?: any;
    }[];
    scheduledTime: Date;
  }): Promise<ScheduledPost> {
    // Validate scheduling time
    if (params.scheduledTime <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // Create scheduled post record
    const scheduledPost = await this.scheduledPostRepo.save({
      userId: params.userId,
      content: params.content,
      mediaUrls: params.mediaUrls,
      platforms: params.platforms,
      scheduledTime: params.scheduledTime,
      status: ScheduleStatus.PENDING,
    });

    return scheduledPost;
  }

  async getScheduledPosts(
    userId: string,
    filters?: {
      status?: ScheduleStatus;
      startDate?: Date;
      endDate?: Date;
      platform?: SocialPlatform;
    },
  ): Promise<ScheduledPost[]> {
    const queryBuilder = this.scheduledPostRepo
      .createQueryBuilder('post')
      .where('post.userId = :userId', { userId });

    if (filters?.status) {
      queryBuilder.andWhere('post.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('post.scheduledTime >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('post.scheduledTime <= :endDate', {
        endDate: filters.endDate,
      });
    }

    if (filters?.platform) {
      queryBuilder.andWhere('post.platforms @> :platform', {
        platform: JSON.stringify([{ platform: filters.platform }]),
      });
    }

    return queryBuilder.orderBy('post.scheduledTime', 'ASC').getMany();
  }

  async updateScheduledPost(
    postId: string,
    userId: string,
    updates: {
      content?: string;
      mediaUrls?: string[];
      platforms?: {
        platform: SocialPlatform;
        accountId: string;
        platformSpecificParams?: any;
      }[];
      scheduledTime?: Date;
    },
  ): Promise<ScheduledPost> {
    const post = await this.scheduledPostRepo.findOne({
      where: { id: postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Scheduled post not found');
    }

    if (post.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException('Can only update pending posts');
    }

    if (updates.scheduledTime && updates.scheduledTime <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    await this.scheduledPostRepo.update(postId, updates);

    return this.scheduledPostRepo.findOne({ where: { id: postId } });
  }

  async cancelScheduledPost(postId: string, userId: string): Promise<void> {
    const post = await this.scheduledPostRepo.findOne({
      where: { id: postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Scheduled post not found');
    }

    if (post.status !== ScheduleStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending posts');
    }

    await this.scheduledPostRepo.update(postId, {
      status: ScheduleStatus.CANCELLED,
    });
  }

  private mapPublishStatusToScheduleStatus(
    publishStatus: PublishStatus,
  ): ScheduleStatus {
    switch (publishStatus) {
      case PublishStatus.COMPLETED:
        return ScheduleStatus.PUBLISHED;
      case PublishStatus.PARTIALLY_COMPLETED:
        return ScheduleStatus.PARTIALLY_PUBLISHED;
      case PublishStatus.FAILED:
        return ScheduleStatus.FAILED;
      default:
        return ScheduleStatus.FAILED;
    }
  }
}
