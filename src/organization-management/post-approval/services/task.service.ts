import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Task, TaskStatus, TaskType } from '../entities/task.entity';
import { UserPost } from '../entities/post.entity';
import { ApprovalStep } from '../entities/approval-step.entity';
import { User } from '../../../user-management/entities/user.entity';
import { CreateTaskDto } from '../helper/dto/create-task.dto';

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
    // Validate that the assignee exists and belongs to the organization
    const assignee = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.organization', 'organization')
      .where('user.id = :userId', { userId: createTaskDto.assigneeId })
      .andWhere('organization.id = :organizationId', { organizationId })
      .getOne();

    if (!assignee) {
      throw new NotFoundException(
        `User with ID ${createTaskDto.assigneeId} not found in organization`,
      );
    }

    // Create the task
    const task = this.taskRepository.create({
      ...createTaskDto,
      organizationId,
      tenantId,
    });

    return this.taskRepository.save(task);
  }

  async createReviewTask(
    post: UserPost,
    approvalStep: ApprovalStep,
    entityManager?: EntityManager,
  ): Promise<Task> {
    // Find organization members with the required role
    const assignee = await this.getorganizationMemberWithLowestWorkload(
      post.organizationId,
      approvalStep.requiredRole,
    );

    if (!assignee) {
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
      assigneeId: assignee.id,
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
    // Find users with manager role in the organization
    const managers = await this.findorganizationMembersWithRole(
      post.organizationId,
      'manager',
    );

    if (managers.length === 0) {
      this.logger.warn(
        `No managers found in organization ${post.organizationId}`,
      );
      return null;
    }

    // Find manager with lowest workload
    const assignee = await this.getorganizationMemberWithLowestWorkload(
      post.organizationId,
      'manager',
    );

    const task = this.taskRepository.create({
      title: `Publish approved post: ${post.title}`,
      description: `The post has been approved and is ready for publishing`,
      type: TaskType.PUBLISH,
      postId: post.id,
      assigneeId: assignee.id,
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

    for (const task of tasks) {
      task.status = TaskStatus.COMPLETED;
    }

    if (entityManager) {
      await entityManager.save(Task, tasks);
    } else {
      await this.taskRepository.save(tasks);
    }
  }

  async completeTask(taskId: string, userId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, assigneeId: userId },
    });

    if (!task) {
      throw new NotFoundException(
        `Task with ID ${taskId} not found or not assigned to user`,
      );
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

    for (const task of tasks) {
      task.status = TaskStatus.COMPLETED;
    }

    if (entityManager) {
      await entityManager.save(Task, tasks);
    } else {
      await this.taskRepository.save(tasks);
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
      .leftJoinAndSelect('task.assignee', 'assignee')
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
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('task.assigneeId = :userId', { userId })
      .andWhere('task.organizationId = :organizationId', { organizationId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }

  async getorganizationTasks(
    organizationId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.organizationId = :organizationId', { organizationId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }

  async reassignTask(
    taskId: string,
    newAssigneeId: string,
    tenantId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    task.assigneeId = newAssigneeId;
    return this.taskRepository.save(task);
  }

  // Helper method to find organization members with a specific role
  private async findorganizationMembersWithRole(
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

  private async getorganizationMemberWithLowestWorkload(
    organizationId: string,
    roleName: string,
  ): Promise<User> {
    // Get users with the required role
    const users = await this.findorganizationMembersWithRole(
      organizationId,
      roleName,
    );

    if (users.length === 0) {
      return null;
    }

    // If only one user has the role, return them
    if (users.length === 1) {
      return users[0];
    }

    // Get pending tasks count for each user
    const userWorkloads = await Promise.all(
      users.map(async (user) => {
        const pendingTasksCount = await this.taskRepository.count({
          where: {
            assigneeId: user.id,
            organizationId,
            status: TaskStatus.PENDING,
          },
        });

        return {
          user,
          pendingTasksCount,
        };
      }),
    );

    // Sort users by pending task count (ascending)
    userWorkloads.sort((a, b) => a.pendingTasksCount - b.pendingTasksCount);

    // Return the user with the lowest workload
    return userWorkloads[0].user;
  }
}
