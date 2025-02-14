import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../../../entities/user.entity';
import { Message } from '../../../entities/message.entity';
import { Role } from '../../../entities/role.entity';
import { Permissions } from '../../../entities/permissions.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { Post } from '../../../entities/post.entity';
import { ConversationMember } from '../../../entities/conversation-members.entity';
import { Conversation } from '../../../entities/conversation.entity';
import { MessageRead } from '../../../entities/message-read.entity';
import { UserRoleChange } from '../../../entities/user-role-change.entity';
import { Notification } from '../../../entities/notification.entity';
import { Team } from '../../../entities/team.entity';
import { UserTenant } from '../../../entities/user-tenant.entity';

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
    MessageRead,
    Conversation,
    ConversationMember,
    Notification,
    Post,
    Team,
    UserTenant,
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations_history',
});
