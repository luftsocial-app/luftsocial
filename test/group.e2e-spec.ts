import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { AuthHelper } from './helpers/auth.helper';

describe('Groups (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let groupId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    adminToken = AuthHelper.generateAdminToken();
    userToken = AuthHelper.generateUserToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Group Management', () => {
    it('should not create group without token', () => {
      return request(app.getHttpServer())
        .post('/groups')
        .send({
          name: 'Test Group',
          description: 'Test Description',
        })
        .expect(401);
    });

    it('should create group with valid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Group',
          description: 'Test Description',
          isPrivate: false,
          categories: ['tech', 'social'],
        })
        .expect(201);

      groupId = response.body.id;
      expect(response.body.name).toBe('Test Group');
    });

    it('should validate group token permissions', () => {
      const invalidToken = AuthHelper.generateTestToken('fake-id');
      return request(app.getHttpServer())
        .patch(`/groups/${groupId}`)
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({ name: 'Updated Name' })
        .expect(403);
    });
  });

  describe('Group Membership', () => {
    let memberToken: string;

    beforeEach(() => {
      memberToken = AuthHelper.generateTestToken('member-id');
    });

    it('should handle group join requests', async () => {
      await request(app.getHttpServer())
        .post(`/groups/${groupId}/join-requests`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);

      return request(app.getHttpServer())
        .put(`/groups/${groupId}/join-requests/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'member-id' })
        .expect(200);
    });

    it('should manage group roles', async () => {
      return request(app.getHttpServer())
        .put(`/groups/${groupId}/members/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'member-id',
          role: 'moderator',
        })
        .expect(200);
    });

    it('should list group members with roles', () => {
      return request(app.getHttpServer())
        .get(`/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
          expect(res.body[0]).toHaveProperty('role');
        });
    });

    it('should handle member removal', () => {
      return request(app.getHttpServer())
        .delete(`/groups/${groupId}/members/member-id`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Group Content', () => {
    it('should manage group settings', () => {
      return request(app.getHttpServer())
        .patch(`/groups/${groupId}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isPrivate: true,
          joinApprovalRequired: true,
          contentModeration: 'strict',
        })
        .expect(200);
    });

    it('should handle group reports', () => {
      return request(app.getHttpServer())
        .post(`/groups/${groupId}/reports`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'inappropriate_content',
          description: 'Test report',
        })
        .expect(201);
    });
  });
});
