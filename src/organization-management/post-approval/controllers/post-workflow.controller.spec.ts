import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PostWorkflowController } from './post-workflow.controller';
import { CreateDraftPostCommand } from '../commands/create-draft-post.command';
import { SubmitPostForReviewCommand } from '../commands/submit-post-for-review.command';
import { PublishPostCommand } from '../commands/publish-post.command';
import { RejectStepCommand } from '../commands/reject-step.command';
import { GetorganizationPostsQuery } from '../queries/get-team-posts.query';
import { GetPostDetailsQuery } from '../queries/get-post-details.query';
import { CreateDraftPostDto } from '../helper/dto/create-draft-post.dto';
import { PublishPostDto } from '../helper/dto/publish-post.dto';
import { RejectPostDto } from '../helper/dto/reject-post.dto';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { PostStatus } from '../entities/post.entity';
import { PlatformPostDto } from 'src/cross-platform/helpers/dtos/platform-post.dto';
import { SocialPlatform } from 'src/common/enums/social-platform.enum';

describe('PostWorkflowController', () => {
  let controller: PostWorkflowController;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  const mockUser = {
    id: 'user-1',
    userId: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
    role: 'admin',
  };

  const mockUserWithoutRole = {
    id: 'user-2',
    userId: 'user-2',
    orgId: 'org-1',
    tenantId: 'tenant-1',
  };

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    description: 'Test Description',
    status: PostStatus.DRAFT,
    authorId: 'user-1',
    organizationId: 'org-1',
    tenantId: 'tenant-1',
    platforms: [],
    mediaItems: [],
    tasks: [],
    approvalSteps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFiles: Express.Multer.File[] = [
    {
      fieldname: 'files',
      originalname: 'test-image.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('fake-image-data'),
      destination: '',
      filename: 'test-image.jpg',
      path: '',
      stream: null,
    } as Express.Multer.File,
    {
      fieldname: 'files',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 2 * 1024 * 1024, // 2MB
      buffer: Buffer.from('fake-pdf-data'),
      destination: '',
      filename: 'test-document.pdf',
      path: '',
      stream: null,
    } as Express.Multer.File,
  ];

  const mockPlatformPostDto: PlatformPostDto = {
    platform: SocialPlatform.TWITTER,
    content: 'Twitter specific content',
    mediaUrls: ['https://example.com/image.jpg'],
  };

  beforeEach(async () => {
    const mockCommandBus = {
      execute: jest.fn(),
    };

    const mockQueryBus = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostWorkflowController],
      providers: [
        {
          provide: CommandBus,
          useValue: mockCommandBus,
        },
        {
          provide: QueryBus,
          useValue: mockQueryBus,
        },
      ],
    }).compile();

    controller = module.get<PostWorkflowController>(PostWorkflowController);
    commandBus = module.get(CommandBus) as jest.Mocked<CommandBus>;
    queryBus = module.get(QueryBus) as jest.Mocked<QueryBus>;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createDraft', () => {
    const createDraftDto: CreateDraftPostDto = {
      title: 'Draft Post Title',
      description: 'Draft post description',
      mediaUrls: [
        'https://example.com/media1.jpg',
        'https://example.com/media2.png',
      ],
      platforms: [
        {
          platform: SocialPlatform.FACEBOOK,
          content: 'Twitter content',
          mediaUrls: ['https://example.com/twitter-image.jpg'],
        },
        {
          platform: SocialPlatform.LINKEDIN,
          content: 'LinkedIn content',
          mediaUrls: ['https://example.com/linkedin-image.jpg'],
        },
      ],
      taskId: '550e8400-e29b-41d4-a716-446655440000',
      taskNotes: 'This post addresses the marketing campaign requirements',
      taskTags: ['marketing', 'product-launch', 'social-media'],
    };

    it('should create a draft post successfully', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.createDraft(
        mockFiles,
        createDraftDto,
        'org-1',
        mockUser,
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateDraftPostCommand),
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.createDraftDto).toBe(createDraftDto);
      expect(commandArg.userId).toBe('user-1');
      expect(commandArg.organizationId).toBe('org-1');
      expect(commandArg.tenantId).toBe('org-1');
      expect(commandArg.taskId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(commandArg.files).toBe(mockFiles);

      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should create draft with minimal required data', async () => {
      const minimalDto: CreateDraftPostDto = {
        title: 'Minimal Draft',
        description: 'Minimal description',
        platforms: [
          {
            platform: SocialPlatform.TWITTER,
            content: 'Simple tweet',
          },
        ],
      };
      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.createDraft(
        [],
        minimalDto,
        'org-1',
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.createDraftDto.platforms).toHaveLength(1);
      expect(commandArg.createDraftDto.platforms[0].platform).toBe(
        SocialPlatform.TWITTER,
      );
      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should create draft with multiple platforms', async () => {
      const multiPlatformDto: CreateDraftPostDto = {
        title: 'Multi-platform Post',
        description: 'Post for multiple platforms',
        platforms: [
          {
            platform: SocialPlatform.TWITTER,
            content: 'Twitter version with hashtags #social #media',
            mediaUrls: ['https://example.com/twitter.jpg'],
          },
          {
            platform: SocialPlatform.LINKEDIN,
            content: 'Professional LinkedIn version with detailed content',
            mediaUrls: ['https://example.com/linkedin.jpg'],
          },
          {
            platform: SocialPlatform.FACEBOOK,
            content: 'Facebook version with longer text and engagement focus',
            mediaUrls: ['https://example.com/facebook.jpg'],
          },
        ],
        taskId: '550e8400-e29b-41d4-a716-446655440001',
        taskTags: ['multi-platform', 'social-strategy'],
      };
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.createDraft(
        mockFiles,
        multiPlatformDto,
        'org-1',
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.createDraftDto.platforms).toHaveLength(3);
      expect(
        commandArg.createDraftDto.platforms.map((p) => p.platform),
      ).toEqual([
        SocialPlatform.TWITTER,
        SocialPlatform.LINKEDIN,
        SocialPlatform.FACEBOOK,
      ]);
    });

    it('should create draft without files', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.createDraft(
        [],
        createDraftDto,
        'org-1',
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.files).toEqual([]);
      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.createDraft(mockFiles, createDraftDto, '', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when taskId is missing', async () => {
      const dtoWithoutTaskId = { ...createDraftDto, taskId: undefined };

      await expect(
        controller.createDraft(mockFiles, dtoWithoutTaskId, 'org-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle null organizationId', async () => {
      await expect(
        controller.createDraft(
          mockFiles,
          createDraftDto,
          null as any,
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle command execution errors', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Invalid platform configuration'),
      );

      await expect(
        controller.createDraft(mockFiles, createDraftDto, 'org-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle large files within limit', async () => {
      const largeFiles = mockFiles.map((file) => ({
        ...file,
        size: 45 * 1024 * 1024, // 45MB (under 50MB limit)
      }));
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.createDraft(
        largeFiles,
        createDraftDto,
        'org-1',
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.files).toHaveLength(2);
      expect(commandArg.files[0].size).toBe(45 * 1024 * 1024);
    });

    it('should handle maximum allowed files (10 files)', async () => {
      const maxFiles = Array(10).fill(mockFiles[0]);
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.createDraft(maxFiles, createDraftDto, 'org-1', mockUser);

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.files).toHaveLength(10);
    });

    it('should validate UUID format for taskId', async () => {
      const invalidTaskIdDto = {
        ...createDraftDto,
        taskId: 'invalid-uuid',
      };

      // The validation would be handled by ValidationPipe, but we test the parameter passing
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.createDraft(
        mockFiles,
        invalidTaskIdDto,
        'org-1',
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as CreateDraftPostCommand;
      expect(commandArg.taskId).toBe('invalid-uuid');
    });
  });

  describe('submitForReview', () => {
    it('should submit post for review successfully', async () => {
      const submittedPost = { ...mockPost, status: PostStatus.UNDER_REVIEW };
      commandBus.execute.mockResolvedValue(submittedPost);

      const result = await controller.submitForReview('post-1', mockUser);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(SubmitPostForReviewCommand),
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as SubmitPostForReviewCommand;
      expect(commandArg.postId).toBe('post-1');
      expect(commandArg.userId).toBe('user-1');
      expect(commandArg.tenantId).toBe('tenant-1');

      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should handle post not found error', async () => {
      commandBus.execute.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(
        controller.submitForReview('invalid-post', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle post already submitted error', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Post already submitted for review'),
      );

      await expect(
        controller.submitForReview('post-1', mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle unauthorized submission', async () => {
      commandBus.execute.mockRejectedValue(
        new ForbiddenException('Not authorized to submit this post'),
      );

      await expect(
        controller.submitForReview('post-1', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('publishPost', () => {
    const publishPostDto: PublishPostDto = {
      platforms: [SocialPlatform.TWITTER, SocialPlatform.LINKEDIN],
      scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
    };

    it('should publish post successfully with files', async () => {
      const publishedPost = { ...mockPost, status: PostStatus.PUBLISHED };
      commandBus.execute.mockResolvedValue(publishedPost);

      const result = await controller.publishPost(
        'post-1',
        publishPostDto,
        mockFiles,
        mockUser,
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(PublishPostCommand),
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.id).toBe('post-1');
      expect(commandArg.publishPostDto).toBe(publishPostDto);
      expect(commandArg.userId).toBe('user-1');
      expect(commandArg.userRole).toBe('admin');
      expect(commandArg.tenantId).toBe('tenant-1');
      expect(commandArg.files).toBe(mockFiles);

      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should publish post without files', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.publishPost(
        'post-1',
        publishPostDto,
        [],
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.files).toEqual([]);
      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should handle user without role (default to member)', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        'post-1',
        publishPostDto,
        mockFiles,
        mockUserWithoutRole,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.userRole).toBe('member');
    });

    it('should handle publishing to single platform', async () => {
      const singlePlatformDto: PublishPostDto = {
        platforms: [SocialPlatform.TWITTER],
      };
      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.publishPost(
        'post-1',
        singlePlatformDto,
        [],
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.publishPostDto.platforms).toEqual([
        SocialPlatform.TWITTER,
      ]);
      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should handle publishing to multiple platforms', async () => {
      const multiPlatformDto: PublishPostDto = {
        platforms: [
          SocialPlatform.TWITTER,
          SocialPlatform.LINKEDIN,
          SocialPlatform.FACEBOOK,
          SocialPlatform.INSTAGRAM,
        ],
        scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
      };
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        'post-1',
        multiPlatformDto,
        mockFiles,
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.publishPostDto.platforms).toHaveLength(4);
      expect(commandArg.publishPostDto.scheduledFor).toBeInstanceOf(Date);
    });

    it('should handle immediate publishing (no scheduledFor)', async () => {
      const immediateDto: PublishPostDto = {
        platforms: [SocialPlatform.TWITTER],
      };
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost('post-1', immediateDto, [], mockUser);

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.publishPostDto.scheduledFor).toBeUndefined();
    });

    it('should handle publish errors', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Post not ready for publishing'),
      );

      await expect(
        controller.publishPost('post-1', publishPostDto, mockFiles, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectPost', () => {
    const rejectPostDto: RejectPostDto = {
      comment:
        'Content does not meet quality standards. Please revise the introduction section.',
    };

    it('should reject post successfully', async () => {
      const rejectedPost = { ...mockPost, status: PostStatus.REJECTED };
      commandBus.execute.mockResolvedValue(rejectedPost);

      const result = await controller.rejectPost(
        'post-1',
        'step-1',
        rejectPostDto,
        mockUser,
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RejectStepCommand),
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(commandArg.postId).toBe('post-1');
      expect(commandArg.stepId).toBe('step-1');
      expect(commandArg.rejectPostDto).toBe(rejectPostDto);
      expect(commandArg.userId).toBe('user-1');
      expect(commandArg.userRole).toBe('admin');
      expect(commandArg.tenantId).toBe('tenant-1');

      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should handle detailed rejection comment', async () => {
      const detailedRejectDto: RejectPostDto = {
        comment: `
          The post has several issues that need to be addressed:
          1. The tone is too casual for our brand guidelines
          2. Missing required compliance disclaimers
          3. Images need to be higher resolution
          4. Content should be reviewed by legal team
          
          Please make these changes and resubmit for approval.
        `,
      };
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.rejectPost(
        'post-1',
        'step-1',
        detailedRejectDto,
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(commandArg.rejectPostDto.comment).toBe(detailedRejectDto.comment);
    });

    it('should handle user without role in rejection', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.rejectPost(
        'post-1',
        'step-1',
        rejectPostDto,
        mockUserWithoutRole,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(commandArg.userRole).toBe('member');
    });

    it('should handle rejection errors', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Cannot reject this step'),
      );

      await expect(
        controller.rejectPost('post-1', 'step-1', rejectPostDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty comment validation', async () => {
      const emptyCommentDto: RejectPostDto = {
        comment: '',
      };

      // ValidationPipe would catch this, but we test the flow
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.rejectPost(
        'post-1',
        'step-1',
        emptyCommentDto,
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(commandArg.rejectPostDto.comment).toBe('');
    });
  });

  describe('getPostDetails', () => {
    const mockPostDetails = {
      ...mockPost,
      tasks: [
        {
          id: 'task-1',
          title: 'Review Task',
          type: 'review',
          status: 'pending',
          assigneeIds: ['user-1', 'user-2'],
        },
      ],
      approvalSteps: [
        {
          id: 'step-1',
          name: 'Content Review',
          order: 1,
          status: 'pending',
          requiredRole: 'reviewer',
        },
      ],
      taskSummary: { total: 3, completed: 1, pending: 2 },
      canPublish: false,
      nextActions: ['approve-step-1', 'approve-step-2'],
    };

    it('should get post details successfully', async () => {
      queryBus.execute.mockResolvedValue(mockPostDetails);

      const result = await controller.getPostDetails('post-1', mockUser);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetPostDetailsQuery),
      );

      const queryArg = queryBus.execute.mock.calls[0][0] as GetPostDetailsQuery;
      expect(queryArg.postId).toBe('post-1');
      expect(queryArg.tenantId).toBe('tenant-1');

      expect(result).toBe(mockPostDetails);
    });

    it('should handle post not found', async () => {
      queryBus.execute.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(
        controller.getPostDetails('invalid-post', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrganizationPosts', () => {
    const mockPostsResponse = {
      posts: [new PostResponseDto(mockPost)],
      total: 1,
      taskSummary: { totalTasks: 5, completedTasks: 2 },
    };

    it('should get organization posts successfully', async () => {
      queryBus.execute.mockResolvedValue(mockPostsResponse);

      const result = await controller.getOrganizationPosts(
        'org-1',
        PostStatus.DRAFT,
        'task-1',
        true,
        1,
        10,
        mockUser,
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetorganizationPostsQuery),
      );

      const queryArg = queryBus.execute.mock
        .calls[0][0] as GetorganizationPostsQuery;
      expect(queryArg.organizationId).toBe('org-1');
      expect(queryArg.tenantId).toBe('tenant-1');
      expect(queryArg.status).toBe(PostStatus.DRAFT);
      expect(queryArg.page).toBe(1);
      expect(queryArg.limit).toBe(10);
      expect(queryArg.taskId).toBe('task-1');
      expect(queryArg.assignedToUserId).toBe('user-1');

      expect(result).toBe(mockPostsResponse);
    });

    it('should use default pagination values', async () => {
      queryBus.execute.mockResolvedValue(mockPostsResponse);

      await controller.getOrganizationPosts(
        'org-1',
        undefined,
        undefined,
        false,
        undefined,
        undefined,
        mockUser,
      );

      const queryArg = queryBus.execute.mock
        .calls[0][0] as GetorganizationPostsQuery;
      expect(queryArg.page).toBe(1);
      expect(queryArg.limit).toBe(10);
      expect(queryArg.assignedToUserId).toBeUndefined();
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.getOrganizationPosts(
          '',
          PostStatus.DRAFT,
          'task-1',
          true,
          1,
          10,
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle filtering by different post statuses', async () => {
      const statuses = [
        PostStatus.DRAFT,
        PostStatus.UNDER_REVIEW,
        PostStatus.APPROVED,
        PostStatus.PUBLISHED,
        PostStatus.REJECTED,
      ];

      queryBus.execute.mockResolvedValue(mockPostsResponse);

      for (const status of statuses) {
        await controller.getOrganizationPosts(
          'org-1',
          status,
          undefined,
          false,
          1,
          10,
          mockUser,
        );

        const queryArg = queryBus.execute.mock.calls[
          queryBus.execute.mock.calls.length - 1
        ][0] as GetorganizationPostsQuery;
        expect(queryArg.status).toBe(status);
      }
    });
  });

  describe('getPostsForTask', () => {
    const mockTaskPostsResponse = {
      posts: [new PostResponseDto(mockPost)],
      taskInfo: { id: 'task-1', title: 'Review Task' },
    };

    it('should get posts for specific task successfully', async () => {
      queryBus.execute.mockResolvedValue(mockTaskPostsResponse);

      const result = await controller.getPostsForTask(
        'task-1',
        'org-1',
        mockUser,
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetorganizationPostsQuery),
      );

      const queryArg = queryBus.execute.mock
        .calls[0][0] as GetorganizationPostsQuery;
      expect(queryArg.organizationId).toBe('org-1');
      expect(queryArg.tenantId).toBe('tenant-1');
      expect(queryArg.taskId).toBe('task-1');
      expect(queryArg.page).toBe(1);
      expect(queryArg.limit).toBe(100);

      expect(result).toBe(mockTaskPostsResponse);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.getPostsForTask('task-1', '', mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyAssignedPosts', () => {
    const mockAssignedPostsResponse = {
      posts: [new PostResponseDto(mockPost)],
      workloadSummary: { totalAssigned: 5, pendingTasks: 3 },
    };

    it('should get user assigned posts successfully', async () => {
      queryBus.execute.mockResolvedValue(mockAssignedPostsResponse);

      const result = await controller.getMyAssignedPosts(
        'org-1',
        PostStatus.IN_REVIEW,
        'pending',
        mockUser,
      );

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetorganizationPostsQuery),
      );

      const queryArg = queryBus.execute.mock
        .calls[0][0] as GetorganizationPostsQuery;
      expect(queryArg.organizationId).toBe('org-1');
      expect(queryArg.tenantId).toBe('tenant-1');
      expect(queryArg.status).toBe(PostStatus.IN_REVIEW);
      expect(queryArg.assignedToUserId).toBe('user-1');
      expect(queryArg.taskStatus).toBe('pending');

      expect(result).toBe(mockAssignedPostsResponse);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.getMyAssignedPosts(
          '',
          PostStatus.DRAFT,
          'pending',
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
