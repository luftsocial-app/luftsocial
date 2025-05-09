import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Task, TaskStatus, TaskType } from '../entities/task.entity';
import { Post } from '../entities/post.entity';
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
    teamId: string,
    tenantId: string,
  ): Promise<Task> {
    // Validate that the assignee exists and belongs to the team
    const assignee = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.teams', 'team')
      .where('user.id = :userId', { userId: createTaskDto.assigneeId })
      .andWhere('team.id = :teamId', { teamId })
      .getOne();

    if (!assignee) {
      throw new NotFoundException(
        `User with ID ${createTaskDto.assigneeId} not found in team`,
      );
    }

    // Create the task
    const task = this.taskRepository.create({
      ...createTaskDto,
      teamId,
      tenantId,
    });

    return this.taskRepository.save(task);
  }

  async createReviewTask(
    post: Post,
    approvalStep: ApprovalStep,
  ): Promise<Task> {
    // Find users with the required role in the team
    const users = await this.findTeamMembersWithRole(
      post.teamId,
      approvalStep.requiredRole,
    );

    if (users.length === 0) {
      this.logger.warn(
        `No users with role ${approvalStep.requiredRole} found in team ${post.teamId}`,
      );
      return null;
    }

    // For simplicity, we'll assign to the first user with the role
    // In a real app, you might want round-robin or load balancing
    const assignee = users[0];

    const task = this.taskRepository.create({
      title: `Review required: ${post.title}`,
      description: `Please review the post for approval at step: ${approvalStep.name}`,
      type: TaskType.REVIEW,
      postId: post.id,
      approvalStepId: approvalStep.id,
      assigneeId: assignee.id,
      teamId: post.teamId,
      tenantId: post.tenantId,
    });

    return this.taskRepository.save(task);
  }

  async createPublishTask(post: Post): Promise<Task> {
    // Find users with manager role in the team
    const managers = await this.findTeamMembersWithRole(post.teamId, 'manager');

    if (managers.length === 0) {
      this.logger.warn(`No managers found in team ${post.teamId}`);
      return null;
    }

    // Assign to the first manager
    const assignee = managers[0];

    const task = this.taskRepository.create({
      title: `Publish approved post: ${post.title}`,
      description: `The post has been approved and is ready for publishing`,
      type: TaskType.PUBLISH,
      postId: post.id,
      assigneeId: assignee.id,
      teamId: post.teamId,
      tenantId: post.tenantId,
    });

    return this.taskRepository.save(task);
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

  async cancelTasksByPost(postId: string): Promise<void> {
    const tasks = await this.taskRepository.find({
      where: {
        postId,
        status: TaskStatus.PENDING,
      },
    });

    for (const task of tasks) {
      task.status = TaskStatus.CANCELED;
    }

    await this.taskRepository.save(tasks);
  }

  async getTasksByPost(
    postId: string,
    teamId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('task.postId = :postId', { postId })
      .andWhere('task.teamId = :teamId', { teamId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }

  async getUserTasks(
    userId: string,
    teamId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .where('task.assigneeId = :userId', { userId })
      .andWhere('task.teamId = :teamId', { teamId });

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    return query.getMany();
  }

  async getTeamTasks(teamId: string, status?: TaskStatus): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.post', 'post')
      .leftJoinAndSelect('task.approvalStep', 'approvalStep')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.teamId = :teamId', { teamId });

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

  // Helper method to find team members with a specific role
  private async findTeamMembersWithRole(
    teamId: string,
    roleName: string,
  ): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.teams', 'team', 'team.id = :teamId', { teamId })
      .innerJoin('user.roles', 'role', 'role.name = :roleName', { roleName })
      .getMany();
  }
}
