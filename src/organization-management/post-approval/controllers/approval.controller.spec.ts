import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { ApprovalController } from './approval.controller';
import { TenantService } from '../../../user-management/tenant.service';
import { ApproveStepCommand } from '../commands/approve-step.command';
import { RejectStepCommand } from '../commands/reject-step.command';
import { PublishPostCommand } from '../commands/publish-post.command';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { PinoLogger } from 'nestjs-pino';

describe('ApprovalController', () => {
  let controller: ApprovalController;
  let commandBus: jest.Mocked<CommandBus>;
  let tenantService: jest.Mocked<TenantService>;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
  };

  const mockUser = {
    userId: 'user-123',
    orgRole: 'admin',
    roles: ['admin'],
  };

  const mockTenantId = 'tenant-123';
  const mockPostId = 'post-123';
  const mockStepId = 'step-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalController],
      providers: [
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            getTenantId: jest.fn().mockReturnValue(mockTenantId),
          },
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<ApprovalController>(ApprovalController);
    commandBus = module.get(CommandBus);
    tenantService = module.get(TenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('approveMultipleSteps', () => {
    it('should approve multiple steps successfully', async () => {
      const approveMultipleDto = {
        stepIds: ['step-1', 'step-2'],
        comment: 'Approved multiple steps',
      };

      const mockResult = [
        { id: 'step-1', status: 'approved' },
        { id: 'step-2', status: 'approved' },
      ];

      commandBus.execute.mockResolvedValue(mockResult);

      const result = await controller.approveMultipleSteps(
        mockPostId,
        approveMultipleDto,
        mockUser,
      );

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(ApproveStepCommand),
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(executedCommand.postId).toBe(mockPostId);
      expect(executedCommand.stepIds).toEqual(['step-1', 'step-2']);
      expect(executedCommand.approvePostDto.comment).toBe(
        'Approved multiple steps',
      );
      expect(executedCommand.userId).toBe(mockUser.userId);
      expect(executedCommand.userRole).toBe(mockUser.orgRole);
      expect(executedCommand.tenantId).toBe(mockTenantId);

      expect(result).toBe(mockResult);
    });

    it('should approve multiple steps without comment', async () => {
      const approveMultipleDto = {
        stepIds: ['step-1', 'step-2'],
      };

      const mockResult = [
        { id: 'step-1', status: 'approved' },
        { id: 'step-2', status: 'approved' },
      ];

      commandBus.execute.mockResolvedValue(mockResult);

      await controller.approveMultipleSteps(
        mockPostId,
        approveMultipleDto,
        mockUser,
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as ApproveStepCommand;
      expect(executedCommand.approvePostDto.comment).toBeUndefined();
    });

    it('should handle command bus errors', async () => {
      const approveMultipleDto = {
        stepIds: ['step-1'],
        comment: 'Test approval',
      };

      const error = new Error('Command execution failed');
      commandBus.execute.mockRejectedValue(error);

      await expect(
        controller.approveMultipleSteps(
          mockPostId,
          approveMultipleDto,
          mockUser,
        ),
      ).rejects.toThrow('Command execution failed');
    });
  });

  describe('rejectStep', () => {
    it('should reject a step successfully', async () => {
      const rejectPostDto = {
        reason: 'Content not appropriate',
        comment: 'Please revise the content',
      };

      const mockResult = {
        id: mockStepId,
        status: 'rejected',
        reason: rejectPostDto.reason,
      };

      commandBus.execute.mockResolvedValue(mockResult);

      const result = await controller.rejectStep(
        mockPostId,
        mockStepId,
        rejectPostDto,
        mockUser,
      );

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(RejectStepCommand),
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(executedCommand.postId).toBe(mockPostId);
      expect(executedCommand.stepId).toBe(mockStepId);
      expect(executedCommand.rejectPostDto).toBe(rejectPostDto);
      expect(executedCommand.userId).toBe(mockUser.userId);
      expect(executedCommand.userRole).toBe(mockUser.roles[0]);
      expect(executedCommand.tenantId).toBe(mockTenantId);

      expect(result).toBe(mockResult);
    });

    it('should handle rejection with minimal data', async () => {
      const rejectPostDto = {
        reason: 'Rejected',
      };

      const mockResult = {
        id: mockStepId,
        status: 'rejected',
      };

      commandBus.execute.mockResolvedValue(mockResult);

      await controller.rejectStep(
        mockPostId,
        mockStepId,
        rejectPostDto,
        mockUser,
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as RejectStepCommand;
      expect(executedCommand.rejectPostDto.reason).toBe('Rejected');
    });

    it('should handle command bus errors for rejection', async () => {
      const rejectPostDto = {
        reason: 'Test rejection',
      };

      const error = new Error('Rejection failed');
      commandBus.execute.mockRejectedValue(error);

      await expect(
        controller.rejectStep(mockPostId, mockStepId, rejectPostDto, mockUser),
      ).rejects.toThrow('Rejection failed');
    });
  });

  describe('publishPost', () => {
    it('should publish a post successfully', async () => {
      const publishPostDto = {
        scheduledFor: new Date('2024-01-01T12:00:00Z'),
        platforms: ['instagram', 'facebook'],
      };

      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'test.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('test image'),
          size: 1024,
        },
      ] as Express.Multer.File[];

      const mockPost = {
        id: mockPostId,
        title: 'Test Post',
        status: 'published',
        publishedAt: new Date(),
      };

      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.publishPost(
        mockPostId,
        publishPostDto,
        mockFiles,
        mockUser,
      );

      expect(tenantService.getTenantId).toHaveBeenCalled();
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(PublishPostCommand),
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(executedCommand.postId).toBe(mockPostId);
      expect(executedCommand.publishPostDto).toBe(publishPostDto);
      expect(executedCommand.userId).toBe(mockUser.userId);
      expect(executedCommand.userRole).toBe(mockUser.roles[0]);
      expect(executedCommand.tenantId).toBe(mockTenantId);
      expect(executedCommand.files).toBe(mockFiles);

      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should publish post without files', async () => {
      const publishPostDto = {
        scheduledFor: new Date('2024-01-01T12:00:00Z'),
        platforms: ['twitter'],
      };

      const mockPost = {
        id: mockPostId,
        title: 'Text Only Post',
        status: 'published',
      };

      commandBus.execute.mockResolvedValue(mockPost);

      const result = await controller.publishPost(
        mockPostId,
        publishPostDto,
        [], // No files
        mockUser,
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(executedCommand.files).toEqual([]);
      expect(result).toBeInstanceOf(PostResponseDto);
    });

    it('should handle publish command errors', async () => {
      const publishPostDto = {
        platforms: ['instagram'],
      };

      const error = new Error('Publishing failed');
      commandBus.execute.mockRejectedValue(error);

      await expect(
        controller.publishPost(mockPostId, publishPostDto, [], mockUser),
      ).rejects.toThrow('Publishing failed');
    });

    it('should handle user with different role structure', async () => {
      const userWithMultipleRoles = {
        userId: 'user-456',
        orgRole: 'manager',
        roles: ['manager', 'editor'],
      };

      const publishPostDto = {
        platforms: ['facebook'],
      };

      const mockPost = {
        id: mockPostId,
        status: 'published',
      };

      commandBus.execute.mockResolvedValue(mockPost);

      await controller.publishPost(
        mockPostId,
        publishPostDto,
        [],
        userWithMultipleRoles,
      );

      const executedCommand = commandBus.execute.mock
        .calls[0][0] as PublishPostCommand;
      expect(executedCommand.userRole).toBe('manager'); // Should use first role
    });
  });

  describe('Integration Tests', () => {
    it('should handle tenant service errors gracefully', async () => {
      tenantService.getTenantId.mockImplementation(() => {
        throw new Error('Tenant service unavailable');
      });

      const approveMultipleDto = {
        stepIds: ['step-1'],
      };

      await expect(
        controller.approveMultipleSteps(
          mockPostId,
          approveMultipleDto,
          mockUser,
        ),
      ).rejects.toThrow('Tenant service unavailable');
    });

    it('should pass correct parameters across all methods', async () => {
      // Test that all methods correctly extract and pass parameters
      const testUser = {
        userId: 'test-user',
        orgRole: 'reviewer',
        roles: ['reviewer'],
      };

      commandBus.execute.mockResolvedValue({});

      // Test approve
      await controller.approveMultipleSteps(
        'test-post',
        { stepIds: ['test-step'] },
        testUser,
      );

      // Test reject
      await controller.rejectStep(
        'test-post',
        'test-step',
        { reason: 'test' },
        testUser,
      );

      // Test publish
      await controller.publishPost(
        'test-post',
        { platforms: ['test'] },
        [],
        testUser,
      );

      // Verify all calls have correct tenant ID
      expect(commandBus.execute).toHaveBeenCalledTimes(3);
      commandBus.execute.mock.calls.forEach((call) => {
        expect(call[0].tenantId).toBe(mockTenantId);
      });
    });
  });
});
