import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../../entities/users/user.entity';
import { Message } from '../../entities/chats/message.entity';
import { Role } from '../../entities/roles/role.entity';
import { Permissions } from '../../entities/roles/permissions.entity';
import { Tenant } from '../../entities/users/tenant.entity';
import { Post } from '../../entities/posts/post.entity';
import { ChatParticipants } from '../../entities/chats/chat-participants.entity';
import { Conversation } from '../../entities/chats/conversation.entity';
import { UserRoleChange } from '../../entities/roles/user-role-change.entity';
import { Notification } from '../../entities/notifications/notification.entity';
import { Team } from '../../entities/users/team.entity';
import { UserTenant } from '../../entities/users/user-tenant.entity';

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
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations_history',
});
