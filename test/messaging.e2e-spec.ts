import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Messaging (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let conversationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Messaging Operations', () => {
    it('should create a conversation', async () => {
      const response = await request(app.getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          participantIds: ['user2-id'],
        })
        .expect(201);

      conversationId = response.body.id;
    });

    it('should send a message', () => {
      return request(app.getHttpServer())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Hello, this is a test message',
          type: 'text',
        })
        .expect(201);
    });

    it('should get conversation messages', () => {
      return request(app.getHttpServer())
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
        });
    });

    it('should list conversations', () => {
      return request(app.getHttpServer())
        .get('/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
        });
    });
  });
});
