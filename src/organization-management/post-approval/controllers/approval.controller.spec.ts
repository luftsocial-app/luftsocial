import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApproveStepCommand } from '../commands/approve-step.command';
import { RejectStepCommand } from '../commands/reject-step.command';
import { PublishPostCommand } from '../commands/publish-post.command';
import { ApprovePostDto } from '../helper/dto/approve-post.dto';
import { RejectPostDto } from '../helper/dto/reject-post.dto';
import { PublishPostDto } from '../helper/dto/publish-post.dto';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { SocialPlatform } from 'src/common/enums/social-platform.enum';

describe('ApprovalController', () => {
  let controller: ApprovalController;
  let commandBus: jest.Mocked<CommandBus>;

  const mockUser = {
    id: 'user-1',
    userId: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
    roles: ['admin'],
  };

  const mockUserWithMultipleRoles = {
    id: 'user-2',
    userId: 'user-2',
    orgId: 'org-1',
    tenantId: 'tenant-1',
    roles: ['reviewer', 'member'],
  };

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test Content',
    status: 'approved',
    organizationId: 'org-1',
    tenantId: 'tenant-1',
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

  beforeEach(async () => {
    const mockCommandBus = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalController],
      providers: [
        {
          provide: CommandBus,
          useValue: mockCommandBus,
        },
      ],
    }).compile();

    controller = module.get<ApprovalController>(ApprovalController);
    commandBus = module.get(CommandBus) as jest.Mocked<CommandBus>;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('approveStep', () => {
    const approvePostDto: ApprovePostDto = {
      comment: 'This post looks good to me',
    };

    it('should approve a step successfully', async () => {
      const expectedResult = {
        success: true,
        message: 'Step approved successfully',
        post: mockPost,
      };
      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.approveStep(
        'post-1',
        'step-1',
        approvePostDto,
        mockUser,
      );

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(ApproveStepCommand),
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(commandArg.postId).toBe('post-1');
      expect(commandArg.stepId).toBe('step-1');
      expect(commandArg.approvePostDto).toBe(approvePostDto);
      expect(commandArg.userId).toBe('user-1');
      expect(commandArg.userRole).toBe('admin');
      expect(commandArg.tenantId).toBe('tenant-1');

      expect(result).toBe(expectedResult);
    });

    it('should handle user with multiple roles (use first role)', async () => {
      const expectedResult = { success: true, message: 'Step approved' };
      commandBus.execute.mockResolvedValue(expectedResult);

      await controller.approveStep(
        'post-1',
        'step-1',
        approvePostDto,
        mockUserWithMultipleRoles,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(commandArg.userRole).toBe('reviewer'); // First role in array
    });

    it('should handle user with no roles gracefully', async () => {
      const userWithNoRoles = { ...mockUser, roles: [] };
      const expectedResult = { success: true, message: 'Step approved' };
      commandBus.execute.mockResolvedValue(expectedResult);

      await controller.approveStep(
        'post-1',
        'step-1',
        approvePostDto,
        userWithNoRoles,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(commandArg.userRole).toBeUndefined();
    });

    it('should handle user with undefined roles', async () => {
      const userWithUndefinedRoles = { ...mockUser, roles: undefined };
      const expectedResult = { success: true, message: 'Step approved' };
      commandBus.execute.mockResolvedValue(expectedResult);

      await controller.approveStep(
        'post-1',
        'step-1',
        approvePostDto,
        userWithUndefinedRoles,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(commandArg.userRole).toBeUndefined();
    });

    it('should handle approval with minimal data', async () => {
      const minimalApproveDto: ApprovePostDto = {};
      const expectedResult = { success: true };
      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.approveStep(
        'post-1',
        'step-1',
        minimalApproveDto,
        mockUser,
      );

      expect(result).toBe(expectedResult);
    });

    it('should handle command bus execution errors', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Invalid approval step'),
      );

      await expect(
        controller.approveStep('post-1', 'step-1', approvePostDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle step not found error', async () => {
      commandBus.execute.mockRejectedValue(
        new NotFoundException('Approval step not found'),
      );

      await expect(
        controller.approveStep(
          'post-1',
          'invalid-step',
          approvePostDto,
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle insufficient permissions error', async () => {
      commandBus.execute.mockRejectedValue(
        new ForbiddenException('Insufficient permissions to approve this step'),
      );

      await expect(
        controller.approveStep('post-1', 'step-1', approvePostDto, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle network/database errors', async () => {
      commandBus.execute.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.approveStep('post-1', 'step-1', approvePostDto, mockUser),
      ).rejects.toThrow(Error);
    });
  });

  describe('rejectStep', () => {
    const rejectPostDto: RejectPostDto = {
      comment: 'Please revise the introduction section',
    };

    it('should reject a step successfully', async () => {
      const expectedResult = {
        success: true,
        message: 'Step rejected successfully',
        post: mockPost,
      };
      commandBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.rejectStep(
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

      expect(result).toBe(expectedResult);
    });

    it('should handle user with multiple roles for rejection', async () => {
      commandBus.execute.mockResolvedValue({ success: true });

      await controller.rejectStep(
        'post-1',
        'step-1',
        rejectPostDto,
        mockUserWithMultipleRoles,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(commandArg.userRole).toBe('reviewer');
    });

    it('should handle command bus execution errors for rejection', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Invalid rejection reason'),
      );

      await expect(
        controller.rejectStep('post-1', 'step-1', rejectPostDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle post not found error', async () => {
      commandBus.execute.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(
        controller.rejectStep(
          'invalid-post',
          'step-1',
          rejectPostDto,
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle already processed step error', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Step has already been processed'),
      );

      await expect(
        controller.rejectStep('post-1', 'step-1', rejectPostDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('publishPost', () => {
    const publishPostDto: PublishPostDto = {
      scheduledFor: new Date(),
      platforms: [SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM],
    };

    it('should publish a post successfully with files', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

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
      expect(commandArg.postId).toBe('post-1');
      expect(commandArg.publishPostDto).toBe(publishPostDto);
      expect(commandArg.userId).toBe('user-1');
      expect(commandArg.userRole).toBe('admin');
      expect(commandArg.tenantId).toBe('tenant-1');
      expect(commandArg.files).toBe(mockFiles);

      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should publish a post successfully without files', async () => {
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

    it('should handle maximum allowed files (10 files)', async () => {
      const maxFiles = Array(10).fill(mockFiles[0]);
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        'post-1',
        publishPostDto,
        maxFiles,
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.files).toHaveLength(10);
    });

    it('should handle user with multiple roles for publishing', async () => {
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        'post-1',
        publishPostDto,
        mockFiles,
        mockUserWithMultipleRoles,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.userRole).toBe('reviewer');
    });

    it('should handle different file types', async () => {
      const diverseFiles: Express.Multer.File[] = [
        { ...mockFiles[0], mimetype: 'image/png', originalname: 'image.png' },
        { ...mockFiles[1], mimetype: 'text/plain', originalname: 'readme.txt' },
        { ...mockFiles[0], mimetype: 'video/mp4', originalname: 'video.mp4' },
      ];
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        'post-1',
        publishPostDto,
        diverseFiles,
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.files).toHaveLength(3);
      expect(commandArg.files.map((f) => f.mimetype)).toEqual([
        'image/png',
        'text/plain',
        'video/mp4',
      ]);
    });

    it('should handle command bus execution errors for publishing', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Post is not ready for publishing'),
      );

      await expect(
        controller.publishPost('post-1', publishPostDto, mockFiles, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle post not found error', async () => {
      commandBus.execute.mockRejectedValue(
        new NotFoundException('Post not found'),
      );

      await expect(
        controller.publishPost(
          'invalid-post',
          publishPostDto,
          mockFiles,
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle insufficient permissions for publishing', async () => {
      commandBus.execute.mockRejectedValue(
        new ForbiddenException('Only admins can publish posts'),
      );

      await expect(
        controller.publishPost('post-1', publishPostDto, mockFiles, mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle post already published error', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('Post has already been published'),
      );

      await expect(
        controller.publishPost('post-1', publishPostDto, mockFiles, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle file processing errors', async () => {
      commandBus.execute.mockRejectedValue(
        new BadRequestException('File processing failed'),
      );

      await expect(
        controller.publishPost('post-1', publishPostDto, mockFiles, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle large file scenarios', async () => {
      const largeFile: Express.Multer.File = {
        ...mockFiles[0],
        size: 45 * 1024 * 1024, // 45MB (under 50MB limit)
        originalname: 'large-video.mp4',
      };
      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        'post-1',
        publishPostDto,
        [largeFile],
        mockUser,
      );

      const commandArg = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(commandArg.files[0].size).toBe(45 * 1024 * 1024);
    });
  });

  describe('Command Construction', () => {
    it('should construct ApproveStepCommand with correct parameters', async () => {
      const approveDto: ApprovePostDto = { comment: 'Approved' };
      commandBus.execute.mockResolvedValue({ success: true });

      await controller.approveStep('post-1', 'step-1', approveDto, mockUser);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 'post-1',
          stepId: 'step-1',
          approvePostDto: approveDto,
          userId: 'user-1',
          userRole: 'admin',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('should construct RejectStepCommand with correct parameters', async () => {
      const rejectDto: RejectPostDto = { comment: 'Needs work' };
      commandBus.execute.mockResolvedValue({ success: true });

      await controller.rejectStep('post-1', 'step-1', rejectDto, mockUser);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 'post-1',
          stepId: 'step-1',
          rejectPostDto: rejectDto,
          userId: 'user-1',
          userRole: 'admin',
          tenantId: 'tenant-1',
        }),
      );
    });
  });

  describe('Response Handling', () => {
    it('should return command result directly for approve step', async () => {
      const commandResult = {
        success: true,
        message: 'Approved',
        postId: 'post-1',
        stepId: 'step-1',
      };
      commandBus.execute.mockResolvedValue(commandResult);

      const result = await controller.approveStep(
        'post-1',
        'step-1',
        { comment: 'Good' },
        mockUser,
      );

      expect(result).toBe(commandResult);
    });

    it('should return command result directly for reject step', async () => {
      const commandResult = {
        success: true,
        message: 'Rejected',
        postId: 'post-1',
        stepId: 'step-1',
      };
      commandBus.execute.mockResolvedValue(commandResult);

      const result = await controller.rejectStep(
        'post-1',
        'step-1',
        { comment: 'Not ready' },
        mockUser,
      );

      expect(result).toBe(commandResult);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string parameters', async () => {
      commandBus.execute.mockResolvedValue({ success: true });

      await controller.approveStep('', '', {}, mockUser);

      const commandArg = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(commandArg.postId).toBe('');
      expect(commandArg.stepId).toBe('');
    });

    it('should handle user object variations', async () => {
      const variations = [
        { ...mockUser, roles: null },
        { ...mockUser, roles: [] },
        { ...mockUser, roles: [''] },
        { ...mockUser, id: '', tenantId: '' },
      ];

      commandBus.execute.mockResolvedValue({ success: true });

      for (const userVariation of variations) {
        await controller.approveStep('post-1', 'step-1', {}, userVariation);
        commandBus.execute.mockClear();
      }

      expect(commandBus.execute).toHaveBeenCalledTimes(0); // Cleared after each call
    });
  });
});
