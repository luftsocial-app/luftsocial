import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import * as Chance from 'chance';

const chance = new Chance();

describe('PostsController', () => {
  let controller: PostsController;

  const mockPostsService = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
  });

  describe('find', () => {
    it('should return all posts', async () => {
      const mockPosts = Array.from({ length: 3 }, () => ({
        id: chance.guid(),
        title: chance.sentence(),
        content: chance.paragraph(),
        authorId: chance.guid(),
        tenantId: chance.guid(),
        createdAt: chance.date(),
        updatedAt: chance.date(),
      }));

      mockPostsService.find.mockResolvedValue(mockPosts);
      const result = await controller.find(chance.guid());

      expect(result).toEqual(mockPosts);
      expect(mockPostsService.find).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const mockError = new Error(chance.sentence());
      mockPostsService.find.mockRejectedValue(mockError);

      await expect(controller.find(chance.guid())).rejects.toThrow();
    });
  });

  // Additional tests for other methods...
});
