import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Posts (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let postId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Post CRUD', () => {
    it('should create a post with media', async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .field('content', 'Test post with media')
        .attach('media', 'test/fixtures/test-image.jpg')
        .expect(201);

      postId = response.body.id;
    });

    it('should like a post', () => {
      return request(app.getHttpServer())
        .post(`/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should add comment to post', () => {
      return request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Test comment' })
        .expect(201);
    });

    it('should get post comments', () => {
      return request(app.getHttpServer())
        .get(`/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBeTruthy();
        });
    });
  });
});
