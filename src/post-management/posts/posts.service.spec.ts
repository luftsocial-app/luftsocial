import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { Post } from '../../database/entities/posts/post.entity';
import { TenantService } from '../../database/tenant.service';
import { NotFoundException } from '@nestjs/common';

describe('PostsService', () => {
  let service: PostsService;

  const mockPostRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockTenantService = {
    getTenantId: jest.fn().mockReturnValue('1'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostRepository,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a post', async () => {
      const mockPost = { id: '1', title: 'Test Post' };
      mockPostRepository.findOne.mockResolvedValue(mockPost);

      const result = await service.findOne('1');
      expect(result).toEqual(mockPost);
    });

    it('should throw NotFoundException when post not found', async () => {
      mockPostRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new post', async () => {
      const postData = { title: 'New Post' };
      const mockPost = { id: '1', ...postData };

      mockPostRepository.create.mockReturnValue(mockPost);
      mockPostRepository.save.mockResolvedValue(mockPost);

      const result = await service.create(postData);
      expect(result).toEqual(mockPost);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when post not found', async () => {
      mockPostRepository.delete = jest.fn().mockResolvedValue({ affected: 0 });

      await expect(service.delete('non-existing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete a post successfully', async () => {
      mockPostRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      await service.delete('existing-id');
      expect(mockPostRepository.delete).toHaveBeenCalledWith({
        id: 'existing-id',
        tenantId: '1',
      });
    });
  });
});
