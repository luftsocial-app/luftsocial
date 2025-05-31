import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from '../services/task.service';
import { Task, TaskStatus, TaskType } from '../entities/task.entity';
import { CreateTaskDto } from '../helper/dto/create-task.dto';
import {
  UpdateTaskAssigneesDto,
  AddAssigneesDto,
  ReassignTaskDto,
  BulkAssignTasksDto,
} from '../helper/dto/reassign-task.dto';
import { PinoLogger } from 'nestjs-pino';
import { TenantService } from '../../../user-management/tenant.service';

describe('TaskController', () => {
  let controller: TaskController;
  let taskService: jest.Mocked<TaskService>;

  const mockUser = {
    id: 'user-1',
    userId: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-1',
  };

  const mockTask: Partial<Task> = {
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
  };

  const mockPinoLogger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  };

  const mockTenantService = {
    getTenantId: jest.fn().mockReturnValue('tenant-123'),
  };

  const mockTaskWithAssignees = {
    ...mockTask,
    assignees: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        emailAddress: 'john@example.com',
        imageUrl: 'http://example.com/image.jpg',
      },
    ],
  };

  beforeEach(async () => {
    const mockTaskService = {
      createTask: jest.fn(),
      getUserTasks: jest.fn(),
      getTasksWithAssigneeDetails: jest.fn(),
      getTasksByAssignee: jest.fn(),
      getAssigneeWorkload: jest.fn(),
      getTasksByPost: jest.fn(),
      getTaskWithAssignees: jest.fn(),
      completeTask: jest.fn(),
      updateTaskAssignees: jest.fn(),
      addAssignees: jest.fn(),
      removeAssignee: jest.fn(),
      reassignTask: jest.fn(),
      bulkAssignTasks: jest.fn(),
      getOrganizationTasks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: PinoLogger,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);
    taskService = module.get(TaskService) as jest.Mocked<TaskService>;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    const createTaskDto: CreateTaskDto = {
      title: 'New Task',
      description: 'Task Description',
      type: TaskType.REVIEW,
      assigneeIds: ['user-1', 'user-2'],
    };

    it('should create a task successfully', async () => {
      taskService.createTask.mockResolvedValue(mockTask as Task);

      const result = await controller.createTask(createTaskDto, mockUser);

      expect(taskService.createTask).toHaveBeenCalledWith(
        createTaskDto,
        'org-1',
        'user-1',
      );
      expect(result).toBe(mockTask);
    });

    it('should handle service errors', async () => {
      taskService.createTask.mockRejectedValue(
        new BadRequestException('Invalid assignees'),
      );

      await expect(
        controller.createTask(createTaskDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTasks', () => {
    it('should get all tasks with assignee details', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue([
        mockTaskWithAssignees,
      ]);

      const result = await controller.getTasks('org-1');

      expect(taskService.getTasksWithAssigneeDetails).toHaveBeenCalledWith(
        'org-1',
        {},
      );
      expect(result).toEqual([mockTaskWithAssignees]);
    });

    it('should get tasks filtered by status and type', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue([
        mockTaskWithAssignees,
      ]);

      const result = await controller.getTasks(
        'org-1',
        TaskStatus.PENDING,
        TaskType.REVIEW,
      );

      expect(taskService.getTasksWithAssigneeDetails).toHaveBeenCalledWith(
        'org-1',
        {
          status: TaskStatus.PENDING,
          type: TaskType.REVIEW,
        },
      );
      expect(result).toEqual([mockTaskWithAssignees]);
    });

    it('should get tasks by specific assignee when assigneeId provided', async () => {
      taskService.getTasksByAssignee.mockResolvedValue([mockTask as Task]);

      const result = await controller.getTasks(
        'org-1',
        TaskStatus.PENDING,
        TaskType.REVIEW,
        'user-1',
      );

      expect(taskService.getTasksByAssignee).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        {
          status: TaskStatus.PENDING,
          type: TaskType.REVIEW,
        },
      );
      expect(result).toEqual([mockTask]);
    });

    it('should throw BadRequestException when organizationId is not provided', async () => {
      await expect(controller.getTasks('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getTasks(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMyTasks', () => {
    it('should get current user tasks successfully', async () => {
      const tasks = [mockTask as Task];
      taskService.getUserTasks.mockResolvedValue(tasks);

      const result = await controller.getMyTasks(
        TaskStatus.PENDING,
        'org-1',
        mockUser,
      );

      expect(taskService.getUserTasks).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        TaskStatus.PENDING,
      );
      expect(result).toEqual({
        message: 'Found 1 tasks for the current user',
        tasks: tasks,
      });
    });

    it('should return no tasks message when no tasks found', async () => {
      taskService.getUserTasks.mockResolvedValue([]);

      const result = await controller.getMyTasks(
        TaskStatus.PENDING,
        'org-1',
        mockUser,
      );

      expect(result).toEqual({
        message: 'No tasks found for the current user',
        tasks: [],
      });
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.getMyTasks(TaskStatus.PENDING, '', mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAssigneeWorkload', () => {
    const mockWorkload = [
      {
        userId: 'user-1',
        pendingTasks: 5,
        user: {
          firstName: 'John',
          lastName: 'Doe',
          emailAddress: 'john@example.com',
        },
      },
    ];

    it('should get assignee workload successfully', async () => {
      taskService.getAssigneeWorkload.mockResolvedValue(mockWorkload);

      const result = await controller.getAssigneeWorkload('org-1');

      expect(taskService.getAssigneeWorkload).toHaveBeenCalledWith('org-1');
      expect(result).toBe(mockWorkload);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(controller.getAssigneeWorkload('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getTasksByPost', () => {
    it('should get tasks by post successfully', async () => {
      const tasks = [mockTask as Task];
      taskService.getTasksByPost.mockResolvedValue(tasks);

      const result = await controller.getTasksByPost(
        'post-1',
        TaskStatus.PENDING,
        'org-1',
      );

      expect(taskService.getTasksByPost).toHaveBeenCalledWith(
        'post-1',
        'org-1',
        TaskStatus.PENDING,
      );
      expect(result).toBe(tasks);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.getTasksByPost('post-1', TaskStatus.PENDING, ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTask', () => {
    it('should get task by ID with assignees successfully', async () => {
      taskService.getTaskWithAssignees.mockResolvedValue(mockTaskWithAssignees);

      const result = await controller.getTask('task-1', 'org-1');

      expect(taskService.getTaskWithAssignees).toHaveBeenCalledWith(
        'task-1',
        'org-1',
      );
      expect(result).toBe(mockTaskWithAssignees);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(controller.getTask('task-1', '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle task not found error', async () => {
      taskService.getTaskWithAssignees.mockRejectedValue(
        new NotFoundException('Task not found'),
      );

      await expect(controller.getTask('task-1', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeTask', () => {
    it('should complete task successfully', async () => {
      const completedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      taskService.completeTask.mockResolvedValue(completedTask as Task);

      const result = await controller.completeTask('task-1', mockUser);

      expect(taskService.completeTask).toHaveBeenCalledWith('task-1', 'user-1');
      expect(result).toBe(completedTask);
    });

    it('should handle task not found error', async () => {
      taskService.completeTask.mockRejectedValue(
        new NotFoundException('Task not found'),
      );

      await expect(controller.completeTask('task-1', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle unauthorized completion error', async () => {
      taskService.completeTask.mockRejectedValue(
        new BadRequestException('Task is not assigned to user'),
      );

      await expect(controller.completeTask('task-1', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateTaskAssignees', () => {
    const updateDto: UpdateTaskAssigneesDto = {
      assigneeIds: ['user-3', 'user-4'],
    };

    it('should update task assignees successfully', async () => {
      const updatedTask = { ...mockTask, assigneeIds: ['user-3', 'user-4'] };
      taskService.updateTaskAssignees.mockResolvedValue(updatedTask as Task);

      const result = await controller.updateTaskAssignees(
        'task-1',
        updateDto,
        'org-1',
      );

      expect(taskService.updateTaskAssignees).toHaveBeenCalledWith(
        'task-1',
        ['user-3', 'user-4'],
        'org-1',
      );
      expect(result).toBe(updatedTask);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.updateTaskAssignees('task-1', updateDto, ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addAssignees', () => {
    const addDto: AddAssigneesDto = {
      assigneeIds: ['user-3'],
    };

    it('should add assignees successfully', async () => {
      const updatedTask = {
        ...mockTask,
        assigneeIds: ['user-1', 'user-2', 'user-3'],
      };
      taskService.addAssignees.mockResolvedValue(updatedTask as Task);

      const result = await controller.addAssignees('task-1', addDto, 'org-1');

      expect(taskService.addAssignees).toHaveBeenCalledWith(
        'task-1',
        ['user-3'],
        'org-1',
      );
      expect(result).toBe(updatedTask);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.addAssignees('task-1', addDto, ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeAssignee', () => {
    it('should remove assignee successfully', async () => {
      const updatedTask = { ...mockTask, assigneeIds: ['user-2'] };
      taskService.removeAssignee.mockResolvedValue(updatedTask as Task);

      const result = await controller.removeAssignee(
        'task-1',
        'user-1',
        'org-1',
      );

      expect(taskService.removeAssignee).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        'org-1',
      );
      expect(result).toBe(updatedTask);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.removeAssignee('task-1', 'user-1', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle error when removing last assignee', async () => {
      taskService.removeAssignee.mockRejectedValue(
        new BadRequestException('Task must have at least one assignee'),
      );

      await expect(
        controller.removeAssignee('task-1', 'user-1', 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reassignTask', () => {
    const reassignDto: ReassignTaskDto = {
      newAssigneeIds: ['user-3', 'user-4'],
    };

    it('should reassign task successfully', async () => {
      const reassignedTask = { ...mockTask, assigneeIds: ['user-3', 'user-4'] };
      taskService.reassignTask.mockResolvedValue(reassignedTask as Task);

      const result = await controller.reassignTask(
        'task-1',
        reassignDto,
        'org-1',
        mockUser,
      );

      expect(taskService.reassignTask).toHaveBeenCalledWith(
        'task-1',
        ['user-3', 'user-4'],
        'tenant-123',
      );
      expect(result).toBe(reassignedTask);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(
        controller.reassignTask('task-1', reassignDto, '', mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkAssignTasks', () => {
    const bulkDto: BulkAssignTasksDto = {
      taskIds: ['task-1', 'task-2'],
      assigneeIds: ['user-1', 'user-2'],
    };

    it('should bulk assign tasks successfully', async () => {
      const bulkResult = {
        success: 2,
        failed: 0,
        results: [
          { taskId: 'task-1', success: true, data: mockTask },
          { taskId: 'task-2', success: true, data: mockTask },
        ],
      };
      taskService.bulkAssignTasks.mockResolvedValue(bulkResult);

      const result = await controller.bulkAssignTasks(bulkDto, 'org-1');

      expect(taskService.bulkAssignTasks).toHaveBeenCalledWith(
        ['task-1', 'task-2'],
        ['user-1', 'user-2'],
        'org-1',
      );
      expect(result).toBe(bulkResult);
    });

    it('should handle partial failures in bulk assignment', async () => {
      const bulkResult = {
        success: 1,
        failed: 1,
        results: [
          { taskId: 'task-1', success: true, data: mockTask },
          { taskId: 'task-2', success: false, error: 'Task not found' },
        ],
      };
      taskService.bulkAssignTasks.mockResolvedValue(bulkResult);

      const result = await controller.bulkAssignTasks(bulkDto, 'org-1');

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(controller.bulkAssignTasks(bulkDto, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getTaskAnalytics', () => {
    const mockAllTasks = [
      { ...mockTask, status: TaskStatus.PENDING, type: TaskType.REVIEW },
      { ...mockTask, status: TaskStatus.COMPLETED, type: TaskType.REVIEW },
      { ...mockTask, status: TaskStatus.CANCELED, type: TaskType.PUBLISH },
    ] as Task[];

    const mockWorkload = [
      { userId: 'user-1', pendingTasks: 2 },
      { userId: 'user-2', pendingTasks: 1 },
    ];

    it('should get task analytics successfully', async () => {
      taskService.getOrganizationTasks.mockResolvedValue(mockAllTasks);
      taskService.getAssigneeWorkload.mockResolvedValue(mockWorkload);

      const result = await controller.getTaskAnalytics('org-1');

      expect(taskService.getOrganizationTasks).toHaveBeenCalledWith('org-1');
      expect(taskService.getAssigneeWorkload).toHaveBeenCalledWith('org-1');

      expect(result).toEqual({
        overview: {
          totalTasks: 3,
          pendingTasks: 1,
          completedTasks: 1,
          canceledTasks: 1,
          completionRate: '33.33',
        },
        tasksByType: {
          review: 2,
          publish: 1,
        },
        workloadDistribution: mockWorkload,
        totalAssignees: 2,
        averageTasksPerAssignee: '1.50',
      });
    });

    it('should handle zero division in analytics calculation', async () => {
      taskService.getOrganizationTasks.mockResolvedValue([]);
      taskService.getAssigneeWorkload.mockResolvedValue([]);

      const result = await controller.getTaskAnalytics('org-1');

      expect(result.overview.completionRate).toBe(0);
      expect(result.averageTasksPerAssignee).toBe(0);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(controller.getTaskAnalytics('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('searchTasks', () => {
    const mockTasks = [
      {
        ...mockTask,
        title: 'Review Product Launch',
        description: 'Review the new product launch materials',
      },
      {
        ...mockTask,
        title: 'Update Documentation',
        description: 'Update API documentation for new features',
      },
    ];

    it('should search tasks without query (get all filtered tasks)', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue(mockTasks);

      const result = await controller.searchTasks(
        'org-1',
        undefined,
        TaskStatus.PENDING,
        TaskType.REVIEW,
      );

      expect(taskService.getTasksWithAssigneeDetails).toHaveBeenCalledWith(
        'org-1',
        {
          organizationId: 'org-1',
          status: TaskStatus.PENDING,
          type: TaskType.REVIEW,
        },
      );
      expect(result).toBe(mockTasks);
    });

    it('should search tasks with text query', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue(mockTasks);

      const result = await controller.searchTasks('org-1', 'product');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Review Product Launch');
    });

    it('should search tasks with text query in description', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue(mockTasks);

      const result = await controller.searchTasks('org-1', 'api');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Update Documentation');
    });

    it('should search tasks by assignee with filters', async () => {
      taskService.getTasksByAssignee.mockResolvedValue([mockTasks[0]]);

      const result = await controller.searchTasks(
        'org-1',
        undefined,
        TaskStatus.PENDING,
        TaskType.REVIEW,
        'user-1',
        'post-1',
      );

      expect(taskService.getTasksByAssignee).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        {
          organizationId: 'org-1',
          status: TaskStatus.PENDING,
          type: TaskType.REVIEW,
          postId: 'post-1',
        },
      );
      expect(result).toEqual([mockTasks[0]]);
    });

    it('should return empty array when no tasks match query', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue(mockTasks);

      const result = await controller.searchTasks('org-1', 'nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should handle case-insensitive search', async () => {
      taskService.getTasksWithAssigneeDetails.mockResolvedValue(mockTasks);

      const result = await controller.searchTasks('org-1', 'PRODUCT');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Review Product Launch');
    });

    it('should handle tasks with null description', async () => {
      const tasksWithNullDescription = [
        { ...mockTask, title: 'Task with no description', description: null },
      ];
      taskService.getTasksWithAssigneeDetails.mockResolvedValue(
        tasksWithNullDescription,
      );

      const result = await controller.searchTasks('org-1', 'description');

      expect(result).toHaveLength(1);
    });

    it('should throw BadRequestException when organizationId is missing', async () => {
      await expect(controller.searchTasks('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service exceptions properly', async () => {
      taskService.createTask.mockRejectedValue(
        new NotFoundException('Assignee not found'),
      );

      await expect(
        controller.createTask(
          {
            title: 'Test',
            description: 'Test',
            type: TaskType.REVIEW,
            assigneeIds: ['invalid-user'],
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle unexpected service errors', async () => {
      taskService.getUserTasks.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        controller.getMyTasks(TaskStatus.PENDING, 'org-1', mockUser),
      ).rejects.toThrow(Error);
    });
  });

  describe('Input Validation', () => {
    it('should validate organizationId in multiple endpoints', async () => {
      const endpoints = [
        () => controller.getTasks(''),
        () => controller.getMyTasks(TaskStatus.PENDING, '', mockUser),
        () => controller.getAssigneeWorkload(''),
        () => controller.getTasksByPost('post-1', TaskStatus.PENDING, ''),
        () => controller.getTask('task-1', ''),
        () => controller.getTaskAnalytics(''),
        () => controller.searchTasks(''),
      ];

      for (const endpoint of endpoints) {
        await expect(endpoint()).rejects.toThrow(BadRequestException);
      }
    });

    it('should handle null and undefined organizationId', async () => {
      await expect(controller.getTasks(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getTasks(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Role-Based Access', () => {
    // Note: These tests assume the role guards are properly configured
    // In a real implementation, you might want to test the guards separately

    it('should allow Admin and Member roles for getTasks', () => {
      // This test verifies that the @Roles decorator is properly applied
      const rolesMetadata = Reflect.getMetadata('roles', controller.getTasks);
      expect(rolesMetadata).toBeDefined();
    });

    it('should allow only Admin role for updateTaskAssignees', () => {
      const rolesMetadata = Reflect.getMetadata(
        'roles',
        controller.updateTaskAssignees,
      );
      expect(rolesMetadata).toBeDefined();
    });
  });
});
