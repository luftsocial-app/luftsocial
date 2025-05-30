import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Task, TaskStatus, TaskType } from '../entities/task.entity';
import { UserPost } from '../entities/post.entity';
import { ApprovalStep } from '../entities/approval-step.entity';
import { User } from '../../../user-management/entities/user.entity';
import { CreateTaskDto } from '../helper/dto/create-task.dto';
import { clerkClient } from '@clerk/express';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TaskService.name);
  }

  async createTask(
    createTaskDto: CreateTaskDto,
    organizationId: string,
    tenantId: string,
  ): Promise<Task> {
    const assigneeIds = createTaskDto.assigneeIds;

    if (!assigneeIds || assigneeIds.length === 0) {
      throw new BadRequestException('At least one assignee is required');
    }

    // Validate that all assignees exist and belong to the organization
    const validationResults = await Promise.allSettled(
      assigneeIds.map((assigneeId) =>
        this.verifyUserInOrganization(assigneeId, organizationId),
      ),
    );

    // Check for any failed validations
    const failedValidations: string[] = [];
    const validAssignees: any[] = [];

    validationResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedValidations.push(assigneeIds[index]);
      } else if (!result.value) {
        failedValidations.push(assigneeIds[index]);
      } else {
        validAssignees.push(result.value);
      }
    });

    if (failedValidations.length > 0) {
      throw new NotFoundException(
        `The following users were not found in the organization: ${failedValidations.join(', ')}`,
      );
    }

    // Create the task with multiple assignees
    const task = this.taskRepository.create({
      ...createTaskDto,
      assigneeIds,
      organizationId,
      tenantId,
    });

    const savedTask = await this.taskRepository.save(task);

    // Validate assignee data to ensure consistency
    savedTask.validateAssigneeData();

    return savedTask;
  }

  async createReviewTask(
    post: UserPost,
    approvalStep: ApprovalStep,
    entityManager?: EntityManager,
  ): Promise<Task> {
    // Find organization members with the required role
    const assignees = await this.getOrganizationMembersWithLowestWorkload(
      post.organizationId,
      approvalStep.requiredRole,
      1, // Get one assignee for now, but can be changed to get multiple
    );

    if (!assignees || assignees.length === 0) {
      this.logger.warn(
        `No users with role ${approvalStep.requiredRole} found in organization ${post.organizationId}`,
      );
      return null;
    }

    const task = this.taskRepository.create({
      title: `Review required: ${post.title}`,
      description: `Please review the post for approval at step: ${approvalStep.name}`,
      type: TaskType.REVIEW,
      postId: post.id,
      approvalStepId: approvalStep.id,
      assigneeIds: assignees.map((user) => user.id), // Use multiple assignees
      organizationId: post.organizationId,
      tenantId: post.tenantId,
    });

    if (entityManager) {
      return entityManager.save(Task, task);
    }

    return this.taskRepository.save(task);
  }

  async createPublishTask(
    post: UserPost,
    entityManager?: EntityManager,
  ): Promise<Task> {
    // Find users with admin role in the organization
    const managers = await this.findOrganizationMembersWithRole(
      post.organizationId,
      'admin',
    );

    if (managers.length === 0) {
      this.logger.warn(`No admin found in organization ${post.organizationId}`);
      return null;
    }

    // Find admin with lowest workload
    const assignees = await this.getOrganizationMembersWithLowestWorkload(
      post.organizationId,
      'admin',
      1, // Get one admin for now
    );

    const task = this.taskRepository.create({
      title: `Publish approved post: ${post.title}`,
      description: `The post has been approved and is ready for publishing`,
      type: TaskType.PUBLISH,
      postId: post.id,
      assigneeIds: assignees.map((user) => user.id), // Use multiple assignees
      organizationId: post.organizationId,
      tenantId: post.tenantId,
    });

    if (entityManager) {
      return entityManager.save(Task, task);
    }

    return this.taskRepository.save(task);
  }

  async completeTaskForStep(
    stepId: string,
    userId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const tasks = await this.taskRepository.find({
      where: {
        approvalStepId: stepId,
        status: TaskStatus.PENDING,
      },
    });

    const updatedTasks = tasks.filter((task) => task.isAssignedTo(userId));

    for (const task of updatedTasks) {
      task.status = TaskStatus.COMPLETED;
    }

    if (entityManager) {
      await entityManager.save(Task, updatedTasks);
    } else {
      await this.taskRepository.save(updatedTasks);
    }
  }

  async completeTask(taskId: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (!task.isAssignedTo(userId)) {
      throw new BadRequestException(`Task is not assigned to user ${userId}`);
    }

    task.status = TaskStatus.COMPLETED;
    return this.taskRepository.save(task);
  }

  async completePublishTasks(
    postId: string,
    userId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const tasks = await this.taskRepository.find({
      where: {
        postId,
        type: TaskType.PUBLISH,
        status: TaskStatus.PENDING,
      },
    });

    const userTasks = tasks.filter((task) => task.isAssignedTo(userId));

    for (const task of userTasks) {
      task.status = TaskStatus.COMPLETED;
    }

    if (entityManager) {
      await entityManager.save(Task, userTasks);
    } else {
      await this.taskRepository.save(userTasks);
    }
  }

  async cancelTasksByPost(
    postId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const tasks = await this.taskRepository.find({
      where: {
        postId,
        status: TaskStatus.PENDING,
      },
    });

    for (const task of tasks) {
      task.status = TaskStatus.CANCELED;
    }

    if (entityManager) {
      await entityManager.save(Task, tasks);
    } else {
      await this.taskRepository.save(tasks);
    }
  }

  async getTasksByPost(
    postId: string,
    organizationId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('task.postId = :postId', { postId })
      .andWhere('task.organizationId = :organizationId', { organizationId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }

  async getUserTasks(
    userId: string,
    organizationId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('task.assigneeIds @> :userId', {
        userId: JSON.stringify([userId]),
      })
      .andWhere('task.organizationId = :organizationId', { organizationId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }
  async getOrganizationTasks(
    organizationId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('task.organizationId = :organizationId', { organizationId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }

  async reassignTask(
    taskId: string,
    newAssigneeIds: string[],
    tenantId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (!newAssigneeIds || newAssigneeIds.length === 0) {
      throw new BadRequestException('At least one assignee is required');
    }

    // Validate all new assignees exist in organization
    const validationResults = await Promise.allSettled(
      newAssigneeIds.map((assigneeId) =>
        this.verifyUserInOrganization(assigneeId, task.organizationId),
      ),
    );

    const failedValidations = validationResults
      .map((result, index) =>
        result.status === 'rejected' || !result.value
          ? newAssigneeIds[index]
          : null,
      )
      .filter((id) => id !== null);

    if (failedValidations.length > 0) {
      throw new NotFoundException(
        `The following users were not found in the organization: ${failedValidations.join(', ')}`,
      );
    }

    task.setAssignees(newAssigneeIds);
    return this.taskRepository.save(task);
  }

  // NEW: Methods for managing multiple assignees

  async addAssigneeToTask(
    taskId: string,
    assigneeId: string,
    organizationId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Verify the assignee is in the organization
    const isValid = await this.verifyUserInOrganization(
      assigneeId,
      organizationId,
    );
    if (!isValid) {
      throw new BadRequestException(
        `User ${assigneeId} not found in organization`,
      );
    }

    task.addAssignee(assigneeId);
    return this.taskRepository.save(task);
  }

  async removeAssigneeFromTask(
    taskId: string,
    assigneeId: string,
    organizationId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    task.removeAssignee(assigneeId);

    if (!task.hasAssignees) {
      throw new BadRequestException('Task must have at least one assignee');
    }

    return this.taskRepository.save(task);
  }

  async updateTaskAssignees(
    taskId: string,
    assigneeIds: string[],
    organizationId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (!assigneeIds || assigneeIds.length === 0) {
      throw new BadRequestException('At least one assignee is required');
    }

    // Validate all assignees
    const validationResults = await Promise.allSettled(
      assigneeIds.map((assigneeId) =>
        this.verifyUserInOrganization(assigneeId, organizationId),
      ),
    );

    const failedValidations = validationResults
      .map((result, index) =>
        result.status === 'rejected' || !result.value
          ? assigneeIds[index]
          : null,
      )
      .filter((id) => id !== null);

    if (failedValidations.length > 0) {
      throw new NotFoundException(
        `The following users were not found in the organization: ${failedValidations.join(', ')}`,
      );
    }

    task.setAssignees(assigneeIds);
    return this.taskRepository.save(task);
  }

  async getTasksWithAssigneeDetails(
    organizationId: string,
    filters?: any,
  ): Promise<any[]> {
    const tasks = await this.taskRepository.find({
      where: {
        organizationId,
        ...filters,
      },
      // relations: ['post', 'approvalStep'],
    });

    // Enhance tasks with assignee information from Clerk
    const tasksWithAssignees = await Promise.all(
      tasks.map(async (task) => {
        if (task.assigneeIds && task.assigneeIds.length > 0) {
          try {
            const assignees = await Promise.all(
              task.assigneeIds.map((id) => clerkClient.users.getUser(id)),
            );

            return {
              ...task,
              assignees: assignees.map((user) => ({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                emailAddress: user.emailAddresses[0]?.emailAddress,
                imageUrl: user.imageUrl,
              })),
            };
          } catch (error) {
            this.logger.error(
              `Failed to fetch assignees for task ${task.id}:`,
              error,
            );
            return {
              ...task,
              assignees: [],
            };
          }
        }

        return {
          ...task,
          assignees: [],
        };
      }),
    );

    return tasksWithAssignees;
  }

  async getTasksByAssignee(
    organizationId: string,
    assigneeId: string,
    filters?: any,
  ): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('JSON_CONTAINS(task.assigneeIds, :userId)', {
        userId: `"${assigneeId}"`,
      })
      .andWhere('task.organizationId = :organizationId', { organizationId });

    if (filters) {
      if (filters.status) {
        query.andWhere('task.status = :status', { status: filters.status });
      }
      if (filters.type) {
        query.andWhere('task.type = :type', { type: filters.type });
      }
    }

    return query.getMany();
  }

  async getTaskWithAssignees(
    taskId: string,
    organizationId: string,
  ): Promise<any> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, organizationId },
      relations: ['post', 'approvalStep'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Enhance with assignee details
    if (task.assigneeIds && task.assigneeIds.length > 0) {
      try {
        const assignees = await Promise.all(
          task.assigneeIds.map((id) => clerkClient.users.getUser(id)),
        );

        return {
          ...task,
          assignees: assignees.map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            emailAddress: user.emailAddresses[0]?.emailAddress,
            imageUrl: user.imageUrl,
          })),
        };
      } catch (error) {
        this.logger.error(
          `Failed to fetch assignees for task ${task.id}:`,
          error,
        );
        return {
          ...task,
          assignees: [],
        };
      }
    }

    return {
      ...task,
      assignees: [],
    };
  }

  async bulkAssignTasks(
    taskIds: string[],
    assigneeIds: string[],
    organizationId: string,
  ): Promise<{ success: number; failed: number; results: any[] }> {
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const taskId of taskIds) {
      try {
        const updatedTask = await this.updateTaskAssignees(
          taskId,
          assigneeIds,
          organizationId,
        );
        results.push({ taskId, success: true, data: updatedTask });
        successCount++;
      } catch (error) {
        results.push({ taskId, success: false, error: error.message });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  async addAssignees(
    taskId: string,
    newAssigneeIds: string[],
    organizationId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, organizationId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Validate all new assignees
    const validationResults = await Promise.allSettled(
      newAssigneeIds.map((assigneeId) =>
        this.verifyUserInOrganization(assigneeId, organizationId),
      ),
    );

    const failedValidations = validationResults
      .map((result, index) =>
        result.status === 'rejected' || !result.value
          ? newAssigneeIds[index]
          : null,
      )
      .filter((id) => id !== null);

    if (failedValidations.length > 0) {
      throw new NotFoundException(
        `The following users were not found in the organization: ${failedValidations.join(', ')}`,
      );
    }

    // Add each new assignee
    newAssigneeIds.forEach((assigneeId) => {
      task.addAssignee(assigneeId);
    });

    return this.taskRepository.save(task);
  }

  async removeAssignee(
    taskId: string,
    assigneeId: string,
    organizationId: string,
  ): Promise<Task> {
    return this.removeAssigneeFromTask(taskId, assigneeId, organizationId);
  }

  async getAssigneeWorkload(organizationId: string): Promise<any> {
    const tasks = await this.taskRepository.find({
      where: { organizationId, status: TaskStatus.PENDING },
    });

    const workloadMap = new Map<string, number>();

    // Count tasks per assignee
    tasks.forEach((task) => {
      if (task.assigneeIds) {
        task.assigneeIds.forEach((assigneeId) => {
          const currentCount = workloadMap.get(assigneeId) || 0;
          workloadMap.set(assigneeId, currentCount + 1);
        });
      }
    });

    // Convert to array format
    const workload = Array.from(workloadMap.entries()).map(
      ([userId, taskCount]) => ({
        userId,
        pendingTasks: taskCount,
      }),
    );

    // Enhance with user details from Clerk
    const workloadWithDetails = await Promise.all(
      workload.map(async (item) => {
        try {
          const user = await clerkClient.users.getUser(item.userId);
          return {
            ...item,
            user: {
              firstName: user.firstName,
              lastName: user.lastName,
              emailAddress: user.emailAddresses[0]?.emailAddress,
            },
          };
        } catch (error) {
          console.error(
            `Failed to fetch user details for ${item.userId}: ${error.message}`,
          );
          this.logger.error(
            `Failed to fetch user details for ${item.userId}: ${error.message}`,
            error.stack,
          );
          return {
            ...item,
            user: {
              firstName: 'Unknown',
              lastName: 'User',
              emailAddress: 'unknown',
            },
          };
        }
      }),
    );

    return workloadWithDetails.sort((a, b) => b.pendingTasks - a.pendingTasks);
  }

  private async verifyUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    try {
      const membershipsResponse =
        await clerkClient.organizations.getOrganizationMembershipList({
          organizationId,
        });

      const memberships = membershipsResponse.data;

      const userMembership = memberships.find(
        (membership) => membership.publicUserData?.userId === userId,
      );

      return !!userMembership;
    } catch (error) {
      this.logger.error(
        `Error verifying user in organization: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  private async findOrganizationMembersWithRole(
    organizationId: string,
    roleName: string,
  ): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin(
        'user.organizations',
        'organization',
        'organization.id = :organizationId',
        { organizationId },
      )
      .innerJoin('user.roles', 'role', 'role.name = :roleName', { roleName })
      .getMany();
  }

  private async getOrganizationMembersWithLowestWorkload(
    organizationId: string,
    roleName: string,
    count: number = 1,
  ): Promise<User[]> {
    // Get users with the required role
    const users = await this.findOrganizationMembersWithRole(
      organizationId,
      roleName,
    );

    if (users.length === 0) {
      return [];
    }

    // If requesting more users than available, return all
    if (users.length <= count) {
      return users;
    }

    // Get pending tasks count for each user using JSON_CONTAINS
    const userWorkloads = await Promise.all(
      users.map(async (user) => {
        const pendingTasksCount = await this.taskRepository
          .createQueryBuilder('task')
          .where('JSON_CONTAINS(task.assigneeIds, :userId)', {
            userId: `"${user.id}"`,
          })
          .andWhere('task.organizationId = :organizationId', { organizationId })
          .andWhere('task.status = :status', { status: TaskStatus.PENDING })
          .getCount();

        return {
          user,
          pendingTasksCount,
        };
      }),
    );

    // Sort users by pending task count (ascending) and return the requested count
    userWorkloads.sort((a, b) => a.pendingTasksCount - b.pendingTasksCount);

    return userWorkloads.slice(0, count).map((item) => item.user);
  }
}
