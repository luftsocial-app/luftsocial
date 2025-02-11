import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../../entities/user.entity';
import { Message } from '../../entities/message.entity';
import { Group } from '../../entities/group.entity';
import { GroupMember } from '../../entities/groupMembers.entity';
import { Role } from '../../entities/role.entity';
import { Permissions } from '../../entities/permissions.entity';
import { Organization } from '../../entities/organization.entity';
import { Post } from '../../entities/post.entity';

config();

const configService = new ConfigService();

export default new DataSource({
    type: 'postgres',
    host: configService.get('DB_HOST'),
    port: configService.get('DB_PORT'),
    username: configService.get('DB_USERNAME'),
    password: configService.get('DB_PASSWORD'),
    database: configService.get('DB_NAME'),
    entities: [User, Message, Group, GroupMember, Role, Permissions, Organization, Post],
    migrations: ['src/migrations/*.ts'],
    migrationsTableName: 'migrations_history'
});
