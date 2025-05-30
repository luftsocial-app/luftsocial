import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TaskService } from './task.service';
import { Task, TaskStatus, TaskType } from '../entities/task.entity';
import { User } from '../../../user-management/entities/user.entity';
import { UserPost } from '../entities/post.entity';
import { ApprovalStep } from '../entities/approval-step.entity';
import { CreateTaskDto } from '../helper/dto/create-task.dto';

// Mock Clerk client
jest.mock('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUser: jest.fn(),
    },
    organizations: {
      getOrganizationMembershipList: jest.fn(),
    },
  },
}));

const { clerkClient } = require('@clerk/express');

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: jest.Mocked<Repository<Task>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let logger: jest.Mocked<PinoLogger>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<Task>>;
  let entityManager: jest.Mocked<EntityManager>;

  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test Description',
    type: TaskType.REVIEW,
    status: TaskStatus.PENDING,
    assigneeIds: ['user-1', 'user-2'],
    organizationId: 'org-1',
    tenantId: 'tenant-1',
    postId: 'post-1',
    approvalStepId: 'step-1',
    isAssignedTo: jest.fn(),
    addAssignee: jest.fn(),
    removeAssignee: jest.fn(),
    setAssignees: jest.fn(),
    validateAssigneeData: jest.fn(),
    hasAssignees: true,
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    organizationId: 'org-1',
    tenantId: 'tenant-1',
  };

  const mockApprovalStep = {
    id: 'step-1',
    name: 'Review Step',
    requiredRole: 'reviewer',
  };

  beforeEach(async () => {
    // Create mock query builder
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getCount: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getRepositoryToken(Task),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepository = module.get(getRepositoryToken(Task));
    userRepository = module.get(getRepositoryToken(User));
    logger = module.get(PinoLogger);

    // Mock entity manager
    entityManager = {
      save: jest.fn(),
    } as any;

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    const createTaskDto: CreateTaskDto = {
      title: 'Test Task',
      description: 'Test Description',
      type: TaskType.REVIEW,
      assigneeIds: ['user-1', 'user-2'],
    };

    it('should create a task successfully', async () => {
      // Mock successful user verification
      jest
        .spyOn(service as any, 'verifyUserInOrganization')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      taskRepository.create.mockReturnValue(mockTask as any);
      taskRepository.save.mockResolvedValue(mockTask as any);

      const result = await service.createTask(
        createTaskDto,
        'org-1',
        'tenant-1',
      );

      expect(service['verifyUserInOrganization']).toHaveBeenCalledTimes(2);
      expect(taskRepository.create).toHaveBeenCalledWith({
        ...createTaskDto,
        assigneeIds: ['user-1', 'user-2'],
        organizationId: 'org-1',
        tenantId: 'tenant-1',
      });
      expect(taskRepository.save).toHaveBeenCalledWith(mockTask);
      expect(mockTask.validateAssigneeData).toHaveBeenCalled();
      expect(result).toBe(mockTask);
    });

    it('should throw BadRequestException when no assignees provided', async () => {
      const invalidDto = { ...createTaskDto, assigneeIds: [] };

      await expect(
        service.createTask(invalidDto, 'org-1', 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when assignees not found in organization', async () => {
      jest
        .spyOn(service as any, 'verifyUserInOrganization')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        service.createTask(createTaskDto, 'org-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle verification errors gracefully', async () => {
      jest
        .spyOn(service as any, 'verifyUserInOrganization')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(true);

      await expect(
        service.createTask(createTaskDto, 'org-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createReviewTask', () => {
    it('should create a review task successfully', async () => {
      jest
        .spyOn(service as any, 'getOrganizationMembersWithLowestWorkload')
        .mockResolvedValue([mockUser]);

      taskRepository.create.mockReturnValue(mockTask as any);
      taskRepository.save.mockResolvedValue(mockTask as any);

      const result = await service.createReviewTask(
        mockPost as UserPost,
        mockApprovalStep as ApprovalStep,
      );

      expect(
        service['getOrganizationMembersWithLowestWorkload'],
      ).toHaveBeenCalledWith('org-1', 'reviewer', 1);
      expect(taskRepository.create).toHaveBeenCalledWith({
        title: 'Review required: Test Post',
        description: 'Please review the post for approval at step: Review Step',
        type: TaskType.REVIEW,
        postId: 'post-1',
        approvalStepId: 'step-1',
        assigneeIds: ['user-1'],
        organizationId: 'org-1',
        tenantId: 'tenant-1',
      });
      expect(result).toBe(mockTask);
    });

    it('should return null when no assignees found', async () => {
      jest
        .spyOn(service as any, 'getOrganizationMembersWithLowestWorkload')
        .mockResolvedValue([]);

      const result = await service.createReviewTask(
        mockPost as UserPost,
        mockApprovalStep as ApprovalStep,
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should use entity manager when provided', async () => {
      jest
        .spyOn(service as any, 'getOrganizationMembersWithLowestWorkload')
        .mockResolvedValue([mockUser]);

      taskRepository.create.mockReturnValue(mockTask as any);
      entityManager.save.mockResolvedValue(mockTask as any);

      const result = await service.createReviewTask(
        mockPost as UserPost,
        mockApprovalStep as ApprovalStep,
        entityManager,
      );

      expect(entityManager.save).toHaveBeenCalledWith(Task, mockTask);
      expect(result).toBe(mockTask);
    });
  });

  describe('createPublishTask', () => {
    it('should create a publish task successfully', async () => {
      jest
        .spyOn(service as any, 'findOrganizationMembersWithRole')
        .mockResolvedValue([mockUser]);
      jest
        .spyOn(service as any, 'getOrganizationMembersWithLowestWorkload')
        .mockResolvedValue([mockUser]);

      taskRepository.create.mockReturnValue(mockTask as any);
      taskRepository.save.mockResolvedValue(mockTask as any);

      const result = await service.createPublishTask(mockPost as UserPost);

      expect(service['findOrganizationMembersWithRole']).toHaveBeenCalledWith(
        'org-1',
        'admin',
      );
      expect(
        service['getOrganizationMembersWithLowestWorkload'],
      ).toHaveBeenCalledWith('org-1', 'admin', 1);
      expect(result).toBe(mockTask);
    });

    it('should return null when no admin found', async () => {
      jest
        .spyOn(service as any, 'findOrganizationMembersWithRole')
        .mockResolvedValue([]);

      const result = await service.createPublishTask(mockPost as UserPost);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('completeTask', () => {
    it('should complete a task successfully', async () => {
      const task = { ...mockTask };
      task.isAssignedTo.mockReturnValue(true);
      taskRepository.findOne.mockResolvedValue(task as any);
      taskRepository.save.mockResolvedValue(task as any);

      const result = await service.completeTask('task-1', 'user-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
      expect(task.isAssignedTo).toHaveBeenCalledWith('user-1');
      expect(task.status).toBe(TaskStatus.COMPLETED);
      expect(result).toBe(task);
    });

    it('should throw NotFoundException when task not found', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.completeTask('task-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when user not assigned to task', async () => {
      const task = { ...mockTask };
      task.isAssignedTo.mockReturnValue(false);
      taskRepository.findOne.mockResolvedValue(task as any);

      await expect(service.completeTask('task-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeTaskForStep', () => {
    it('should complete tasks for step successfully', async () => {
      const tasks = [
        { ...mockTask, isAssignedTo: jest.fn().mockReturnValue(true) },
        { ...mockTask, isAssignedTo: jest.fn().mockReturnValue(false) },
      ];
      taskRepository.find.mockResolvedValue(tasks as any);
      taskRepository.save.mockResolvedValue(tasks as any);

      await service.completeTaskForStep('step-1', 'user-1');

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: {
          approvalStepId: 'step-1',
          status: TaskStatus.PENDING,
        },
      });
      expect(tasks[0].status).toBe(TaskStatus.COMPLETED);
      expect(tasks[1].status).toBe(TaskStatus.PENDING);
    });

    it('should use entity manager when provided', async () => {
      const tasks = [
        { ...mockTask, isAssignedTo: jest.fn().mockReturnValue(true) },
      ];
      taskRepository.find.mockResolvedValue(tasks as any);
      entityManager.save.mockResolvedValue(tasks as any);

      await service.completeTaskForStep('step-1', 'user-1', entityManager);

      expect(entityManager.save).toHaveBeenCalledWith(Task, [tasks[0]]);
    });
  });

  describe('getUserTasks', () => {
    it('should get user tasks successfully', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask]);

      const result = await service.getUserTasks('user-1', 'org-1');

      expect(taskRepository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'task.post',
        'post',
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'task.approvalStep',
        'approvalStep',
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'task.assigneeIds @> :userId',
        {
          userId: JSON.stringify(['user-1']),
        },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task.organizationId = :organizationId',
        {
          organizationId: 'org-1',
        },
      );
      expect(result).toEqual([mockTask]);
    });

    it('should throw BadRequestException when userId is not provided', async () => {
      await expect(service.getUserTasks('', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should filter by status when provided', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask]);

      await service.getUserTasks('user-1', 'org-1', TaskStatus.PENDING);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task.status = :status',
        {
          status: TaskStatus.PENDING,
        },
      );
    });
  });

  describe('reassignTask', () => {
    it('should reassign task successfully', async () => {
      const task = { ...mockTask };
      taskRepository.findOne.mockResolvedValue(task as any);
      taskRepository.save.mockResolvedValue(task as any);
      jest
        .spyOn(service as any, 'verifyUserInOrganization')
        .mockResolvedValue(true);

      const result = await service.reassignTask(
        'task-1',
        ['user-3'],
        'tenant-1',
      );

      expect(taskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1', tenantId: 'tenant-1' },
      });
      expect(task.setAssignees).toHaveBeenCalledWith(['user-3']);
      expect(result).toBe(task);
    });

    it('should throw NotFoundException when task not found', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.reassignTask('task-1', ['user-3'], 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no assignees provided', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask as any);

      await expect(
        service.reassignTask('task-1', [], 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addAssigneeToTask', () => {
    it('should add assignee to task successfully', async () => {
      const task = { ...mockTask };
      taskRepository.findOne.mockResolvedValue(task as any);
      taskRepository.save.mockResolvedValue(task as any);
      jest
        .spyOn(service as any, 'verifyUserInOrganization')
        .mockResolvedValue(true);

      const result = await service.addAssigneeToTask(
        'task-1',
        'user-3',
        'org-1',
      );

      expect(task.addAssignee).toHaveBeenCalledWith('user-3');
      expect(result).toBe(task);
    });

    it('should throw BadRequestException when user not in organization', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask as any);
      jest
        .spyOn(service as any, 'verifyUserInOrganization')
        .mockResolvedValue(false);

      await expect(
        service.addAssigneeToTask('task-1', 'user-3', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeAssigneeFromTask', () => {
    it('should remove assignee from task successfully', async () => {
      const task = { ...mockTask, hasAssignees: true };
      taskRepository.findOne.mockResolvedValue(task as any);
      taskRepository.save.mockResolvedValue(task as any);

      const result = await service.removeAssigneeFromTask(
        'task-1',
        'user-1',
        'org-1',
      );

      expect(task.removeAssignee).toHaveBeenCalledWith('user-1');
      expect(result).toBe(task);
    });

    it('should throw BadRequestException when task would have no assignees', async () => {
      const task = { ...mockTask, hasAssignees: false };
      taskRepository.findOne.mockResolvedValue(task as any);

      await expect(
        service.removeAssigneeFromTask('task-1', 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTasksWithAssigneeDetails', () => {
    it('should get tasks with assignee details successfully', async () => {
      taskRepository.find.mockResolvedValue([mockTask] as any);
      clerkClient.users.getUser.mockResolvedValue({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
        imageUrl: 'http://example.com/image.jpg',
      });

      const result = await service.getTasksWithAssigneeDetails('org-1');

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
      expect(clerkClient.users.getUser).toHaveBeenCalledWith('user-1');
      expect(result[0].assignees).toHaveLength(2);
      expect(result[0].assignees[0]).toEqual({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@example.com',
        imageUrl: 'http://example.com/image.jpg',
      });
    });

    it('should handle clerk API errors gracefully', async () => {
      taskRepository.find.mockResolvedValue([mockTask] as any);
      clerkClient.users.getUser.mockRejectedValue(new Error('API Error'));

      const result = await service.getTasksWithAssigneeDetails('org-1');

      expect(result[0].assignees).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAssigneeWorkload', () => {
    it('should calculate assignee workload successfully', async () => {
      const tasks = [
        { ...mockTask, assigneeIds: ['user-1', 'user-2'] },
        { ...mockTask, assigneeIds: ['user-1'] },
      ];
      taskRepository.find.mockResolvedValue(tasks as any);
      clerkClient.users.getUser.mockResolvedValue({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
      });

      const result = await service.getAssigneeWorkload('org-1');

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', status: TaskStatus.PENDING },
      });
      expect(result).toEqual([
        {
          userId: 'user-1',
          pendingTasks: 2,
          user: {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
          },
        },
        {
          userId: 'user-2',
          pendingTasks: 1,
          user: {
            firstName: 'John',
            lastName: 'Doe',
            emailAddress: 'john@example.com',
          },
        },
      ]);
    });

    it('should handle user fetch errors gracefully', async () => {
      const tasks = [{ ...mockTask, assigneeIds: ['user-1'] }];
      taskRepository.find.mockResolvedValue(tasks as any);
      clerkClient.users.getUser.mockRejectedValue(new Error('API Error'));

      const result = await service.getAssigneeWorkload('org-1');

      expect(result[0].user).toEqual({
        firstName: 'Unknown',
        lastName: 'User',
        emailAddress: 'unknown',
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('bulkAssignTasks', () => {
    it('should bulk assign tasks successfully', async () => {
      jest
        .spyOn(service, 'updateTaskAssignees')
        .mockResolvedValueOnce(mockTask as any)
        .mockRejectedValueOnce(new Error('Task not found'));

      const result = await service.bulkAssignTasks(
        ['task-1', 'task-2'],
        ['user-1'],
        'org-1',
      );

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('verifyUserInOrganization', () => {
    it('should verify user in organization successfully', async () => {
      clerkClient.organizations.getOrganizationMembershipList.mockResolvedValue(
        {
          data: [
            {
              publicUserData: { userId: 'user-1' },
            },
          ],
        },
      );

      const result = await service['verifyUserInOrganization'](
        'user-1',
        'org-1',
      );

      expect(result).toBe(true);
      expect(
        clerkClient.organizations.getOrganizationMembershipList,
      ).toHaveBeenCalledWith({
        organizationId: 'org-1',
      });
    });

    it('should return false when user not found in organization', async () => {
      clerkClient.organizations.getOrganizationMembershipList.mockResolvedValue(
        {
          data: [],
        },
      );

      const result = await service['verifyUserInOrganization'](
        'user-1',
        'org-1',
      );

      expect(result).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      clerkClient.organizations.getOrganizationMembershipList.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await service['verifyUserInOrganization'](
        'user-1',
        'org-1',
      );

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getOrganizationMembersWithLowestWorkload', () => {
    it('should return users with lowest workload', async () => {
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ];
      jest
        .spyOn(service as any, 'findOrganizationMembersWithRole')
        .mockResolvedValue(users);

      queryBuilder.getCount
        .mockResolvedValueOnce(2) // user-1 has 2 tasks
        .mockResolvedValueOnce(1); // user-2 has 1 task

      const result = await service['getOrganizationMembersWithLowestWorkload'](
        'org-1',
        'reviewer',
        1,
      );

      expect(result).toEqual([{ id: 'user-2', name: 'User 2' }]);
    });

    it('should return all users when count is greater than available users', async () => {
      const users = [{ id: 'user-1', name: 'User 1' }];
      jest
        .spyOn(service as any, 'findOrganizationMembersWithRole')
        .mockResolvedValue(users);

      const result = await service['getOrganizationMembersWithLowestWorkload'](
        'org-1',
        'reviewer',
        5,
      );

      expect(result).toEqual(users);
    });

    it('should return empty array when no users found', async () => {
      jest
        .spyOn(service as any, 'findOrganizationMembersWithRole')
        .mockResolvedValue([]);

      const result = await service['getOrganizationMembersWithLowestWorkload'](
        'org-1',
        'reviewer',
        1,
      );

      expect(result).toEqual([]);
    });
  });

  describe('cancelTasksByPost', () => {
    it('should cancel tasks by post successfully', async () => {
      const tasks = [
        { ...mockTask, status: TaskStatus.PENDING },
        { ...mockTask, status: TaskStatus.PENDING },
      ];
      taskRepository.find.mockResolvedValue(tasks as any);
      taskRepository.save.mockResolvedValue(tasks as any);

      await service.cancelTasksByPost('post-1');

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: {
          postId: 'post-1',
          status: TaskStatus.PENDING,
        },
      });
      expect(tasks[0].status).toBe(TaskStatus.CANCELED);
      expect(tasks[1].status).toBe(TaskStatus.CANCELED);
    });

    it('should use entity manager when provided', async () => {
      const tasks = [{ ...mockTask, status: TaskStatus.PENDING }];
      taskRepository.find.mockResolvedValue(tasks as any);
      entityManager.save.mockResolvedValue(tasks as any);

      await service.cancelTasksByPost('post-1', entityManager);

      expect(entityManager.save).toHaveBeenCalledWith(Task, tasks);
    });
  });

  describe('getTasksByPost', () => {
    it('should get tasks by post successfully', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask]);

      const result = await service.getTasksByPost('post-1', 'org-1');

      expect(queryBuilder.where).toHaveBeenCalledWith('task.postId = :postId', {
        postId: 'post-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
      expect(result).toEqual([mockTask]);
    });

    it('should filter by status when provided', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask]);

      await service.getTasksByPost('post-1', 'org-1', TaskStatus.PENDING);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'task.status = :status',
        {
          status: TaskStatus.PENDING,
        },
      );
    });
  });

  describe('getOrganizationTasks', () => {
    it('should get organization tasks successfully', async () => {
      queryBuilder.getMany.mockResolvedValue([mockTask]);

      const result = await service.getOrganizationTasks('org-1');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'task.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
      expect(result).toEqual([mockTask]);
    });
  });

  describe('completePublishTasks', () => {
    it('should complete publish tasks successfully', async () => {
      const tasks = [
        { ...mockTask, isAssignedTo: jest.fn().mockReturnValue(true) },
        { ...mockTask, isAssignedTo: jest.fn().mockReturnValue(false) },
      ];
      taskRepository.find.mockResolvedValue(tasks as any);
      taskRepository.save.mockResolvedValue([tasks[0]] as any);

      await service.completePublishTasks('post-1', 'user-1');

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: {
          postId: 'post-1',
          type: TaskType.PUBLISH,
          status: TaskStatus.PENDING,
        },
      });
      expect(tasks[0].status).toBe(TaskStatus.COMPLETED);
      expect(tasks[1].status).toBe(TaskStatus.PENDING);
    });
  });
});
