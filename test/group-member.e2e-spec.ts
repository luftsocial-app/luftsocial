import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { AuthHelper } from './helpers/auth.helper';
import { DatabaseHelper } from './helpers/database.helper';
import { UserFactory } from './factories/user.factory';
import { GroupFactory } from './factories/group.factory';
import { UserRole } from '../src/common/enums/roles';

describe('Group Members (e2e)', () => {
  let app: INestApplication;
  let groupOwnerToken: string;
  let memberToken: string;
  let moderatorToken: string;
  let groupId: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useFactory({
        factory: async () => {
          const config = DatabaseHelper.getTestDatabaseConfig();
          return new DataSource(config as any);
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    await dataSource.initialize();
    await DatabaseHelper.initializeDataSource(dataSource);

    // Create test users and group
    const owner = await UserFactory.create({ userRole: UserRole.ADMIN });
    const member = await UserFactory.create({ userRole: UserRole.MEMBER });
    const moderator = await UserFactory.create({ userRole: UserRole.MANAGER });

    const group = await GroupFactory.create({});
    groupId = group.id;

    groupOwnerToken = AuthHelper.generateTestToken(owner.id, 'owner');
    memberToken = AuthHelper.generateTestToken(member.id, 'member');
    moderatorToken = AuthHelper.generateTestToken(moderator.id, 'moderator');
  }, 60000); // Increase timeout for database setup

  afterEach(async () => {
    await DatabaseHelper.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Member Management', () => {
    it('should allow members to join public group', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);
    });

    it('should list all members with their roles', () => {
      return request(app.getHttpServer())
        .get(`/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${groupOwnerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
          expect(res.body[0]).toHaveProperty('userRole');
          expect(res.body[0]).toHaveProperty('joinDate');
        });
    });

    it('should allow owner to assign moderator userRole', async () => {
      return request(app.getHttpServer())
        .put(`/groups/${groupId}/members/mod-id/userRole`)
        .set('Authorization', `Bearer ${groupOwnerToken}`)
        .send({ userRole: 'moderator' })
        .expect(200);
    });

    it('should not allow regular members to assign roles', () => {
      return request(app.getHttpServer())
        .put(`/groups/${groupId}/members/mod-id/userRole`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ userRole: 'moderator' })
        .expect(403);
    });
  });

  describe('Member Interactions', () => {
    it('should allow members to update their group profile', () => {
      return request(app.getHttpServer())
        .patch(`/groups/${groupId}/members/profile`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          displayName: 'New Display Name',
          bio: 'Updated member bio',
        })
        .expect(200);
    });

    it('should track member activity', async () => {
      return request(app.getHttpServer())
        .get(`/groups/${groupId}/members/member-id/activity`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
          expect(res.body[0]).toHaveProperty('activityType');
          expect(res.body[0]).toHaveProperty('timestamp');
        });
    });

    it('should handle member warnings', async () => {
      return request(app.getHttpServer())
        .post(`/groups/${groupId}/members/member-id/warnings`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          reason: 'Inappropriate behavior',
          warningLevel: 'moderate',
        })
        .expect(201);
    });
  });

  describe('Member Restrictions', () => {
    it('should allow moderators to mute members', async () => {
      return request(app.getHttpServer())
        .post(`/groups/${groupId}/members/member-id/restrictions`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          type: 'mute',
          duration: '24h',
          reason: 'Spam',
        })
        .expect(201);
    });

    it('should list member restrictions', () => {
      return request(app.getHttpServer())
        .get(`/groups/${groupId}/members/member-id/restrictions`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
          expect(res.body[0]).toHaveProperty('type');
          expect(res.body[0]).toHaveProperty('expiresAt');
        });
    });

    it('should handle member removal', async () => {
      return request(app.getHttpServer())
        .delete(`/groups/${groupId}/members/member-id`)
        .set('Authorization', `Bearer ${groupOwnerToken}`)
        .send({ reason: 'Violation of group rules' })
        .expect(200);
    });
  });

  describe('Member Analytics', () => {
    it('should provide member engagement metrics', () => {
      return request(app.getHttpServer())
        .get(`/groups/${groupId}/members/member-id/analytics`)
        .set('Authorization', `Bearer ${groupOwnerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('postsCount');
          expect(res.body).toHaveProperty('commentsCount');
          expect(res.body).toHaveProperty('lastActive');
          expect(res.body).toHaveProperty('engagementScore');
        });
    });
  });
});
