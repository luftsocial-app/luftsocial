import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../../../entities/users/user.entity';
import { Message } from '../../../entities/chats/message.entity';
import { Role } from '../../../entities/roles/role.entity';
import { Permissions } from '../../../entities/roles/permissions.entity';
import { Tenant } from '../../../entities/users/tenant.entity';
import { Post } from '../../../entities/posts/post.entity';
import { ChatParticipants } from '../../../entities/chats/chat-participants.entity';
import { Conversation } from '../../../entities/chats/conversation.entity';
import { UserRoleChange } from '../../../entities/roles/user-role-change.entity';
import { Notification } from '../../../entities/notifications/notification.entity';
import { Team } from '../../../entities/users/team.entity';
import { UserTenant } from '../../../entities/users/user-tenant.entity';
import { AnalyticsRecord } from 'src/cross-platform/entity/analytics.entity';
import { PublishRecord } from 'src/cross-platform/entity/publish.entity';
import { ScheduledPost } from 'src/cross-platform/entity/schedule.entity';
import { SocialAccount } from 'src/platforms/entity/social-account.entity';
import { AuthState } from 'src/platforms/facebook/entity/auth-state.entity';
import { FacebookAccount } from 'src/platforms/facebook/entity/facebook-account.entity';
import { FacebookPageMetric } from 'src/platforms/facebook/entity/facebook-page-metric.entity';
import { FacebookPage } from 'src/platforms/facebook/entity/facebook-page.entity';
import { FacebookPost } from 'src/platforms/facebook/entity/facebook-post.entity';
import { InstagramAccount } from 'src/platforms/instagram/entities/instagram-account.entity';
import { InstagramMetric } from 'src/platforms/instagram/entities/instagram-metric.entity';
import { InstagramPost } from 'src/platforms/instagram/entities/instagram-post.entity';
import { InstagramRateLimit } from 'src/platforms/instagram/entities/instagram-rate-limit.entity';
import { LinkedInAccount } from 'src/platforms/linkedin/entities/linkedin-account.entity';
import { LinkedInOrganization } from 'src/platforms/linkedin/entities/linkedin-organization.entity';
import {
  LinkedInMetric,
  LinkedInPost,
} from 'src/platforms/linkedin/entities/linkedin-post.entity';
import { TikTokAccount } from 'src/platforms/tiktok/entities/tiktok-account.entity';
import { TikTokMetric } from 'src/platforms/tiktok/entities/tiktok-metric.entity';
import { TikTokVideo } from 'src/platforms/tiktok/entities/tiktok-video.entity';
import { TikTokComment } from 'src/platforms/tiktok/entities/tiktok_comments.entity';
import { TikTokRateLimit } from 'src/platforms/tiktok/entities/tiktok_rate_limits.entity';
import { TikTokUploadSession } from 'src/platforms/tiktok/entities/tiktok_upload_session.entity';
import { FacebookPostMetric } from 'src/platforms/facebook/entity/facebook-post-metric.entity';

config();

const configService = new ConfigService();

export default new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: [
    User,
    Tenant,
    UserRoleChange,
    Permissions,
    Role,
    Message,
    Conversation,
    ChatParticipants,
    Notification,
    Post,
    Team,
    UserTenant,
    SocialAccount,
    AnalyticsRecord,
    PublishRecord,
    ScheduledPost,
    AuthState,
    FacebookAccount,
    FacebookPageMetric,
    FacebookPostMetric,
    FacebookPage,
    FacebookPost,
    InstagramAccount,
    InstagramMetric,
    InstagramPost,
    InstagramRateLimit,
    LinkedInAccount,
    LinkedInMetric,
    LinkedInOrganization,
    LinkedInPost,
    TikTokComment,
    TikTokRateLimit,
    TikTokUploadSession,
    TikTokAccount,
    TikTokMetric,
    TikTokVideo,
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations_history',
});
