import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  BadRequestException,
  UseGuards,
  ValidationPipe,
  Post,
  UsePipes,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import { Role, RoleGuard, Roles } from 'src/guards/role-guard';
import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';
import { TaskService } from '../services/task.service';
import { Task, TaskStatus, TaskType } from '../entities/task.entity';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { CreateTaskDto } from '../helper/dto/create-task.dto';
import {
  UpdateTaskAssigneesDto,
  AddAssigneesDto,
  ReassignTaskDto,
  BulkAssignTasksDto,
} from '../helper/dto/reassign-task.dto';
import { TenantService } from 'src/user-management/tenant.service';

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(RoleGuard, OrganizationAccessGuard)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('new')
  @ApiOperation({ summary: 'Create a new task with multiple assignees' })
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: Task,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  @Roles(Role.Admin, Role.Member)
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: any,
  ): Promise<Task> {
    return this.taskService.createTask(createTaskDto, user.orgId, user.userId);
  }

  @Get('/all')
  @ApiOperation({ summary: 'Get all tasks with assignee details' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TaskStatus,
    description: 'Filter by task status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TaskType,
    description: 'Filter by task type',
  })
  @ApiQuery({
    name: 'assigneeId',
    required: false,
    description: 'Filter by specific assignee ID',
  })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @Roles(Role.Admin, Role.Member)
  async getTasks(
    @Query('organizationId') organizationId: string,
    @Query('status') status?: TaskStatus,
    @Query('type') type?: TaskType,
    @Query('assigneeId') assigneeId?: string,
  ): Promise<any[]> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }
    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    // If filtering by specific assignee
    if (assigneeId) {
      return this.taskService.getTasksByAssignee(
        organizationId,
        assigneeId,
        filters,
      );
    }

    // Get all tasks with assignee details
    return this.taskService.getTasksWithAssigneeDetails(
      organizationId,
      filters,
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'Get tasks assigned to current user' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TaskStatus,
    description: 'Filter by task status',
  })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  async getMyTasks(
    @Query('status') status: TaskStatus,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string; tasks: Task[] }> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    const tasks = await this.taskService.getUserTasks(
      user.userId,
      organizationId,
      status,
    );

    return {
      message:
        tasks.length == 0
          ? 'No tasks found for the current user'
          : `Found ${tasks.length} tasks for the current user`,
      tasks: tasks,
    };
  }

  @Get('workload')
  @ApiOperation({ summary: 'Get assignee workload distribution' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @Roles(Role.Admin, Role.Member)
  async getAssigneeWorkload(
    @Query('organizationId') organizationId: string,
  ): Promise<any> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.getAssigneeWorkload(organizationId);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'Get tasks for a specific post' })
  @ApiParam({ name: 'postId', description: 'Post ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TaskStatus,
    description: 'Filter by task status',
  })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  async getTasksByPost(
    @Param('postId') postId: string,
    @Query('status') status: TaskStatus,
    @Query('organizationId') organizationId: string,
  ): Promise<Task[]> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.getTasksByPost(postId, organizationId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID with assignee details' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @Roles(Role.Admin, Role.Member)
  async getTask(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ): Promise<any> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.getTaskWithAssignees(id, organizationId);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task completed successfully' })
  async completeTask(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<Task> {
    return this.taskService.completeTask(id, user.id);
  }

  @Patch(':id/assignees')
  @ApiOperation({ summary: 'Update task assignees (replace all)' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: UpdateTaskAssigneesDto })
  @ApiResponse({
    status: 200,
    description: 'Task assignees updated successfully',
  })
  @Roles(Role.Admin)
  async updateTaskAssignees(
    @Param('id') id: string,
    @Body() updateDto: UpdateTaskAssigneesDto,
    @Query('organizationId') organizationId: string,
  ): Promise<Task> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.updateTaskAssignees(
      id,
      updateDto.assigneeIds,
      organizationId,
    );
  }

  @Post(':id/assignees')
  @ApiOperation({ summary: 'Add assignees to a task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: AddAssigneesDto })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiResponse({ status: 200, description: 'Assignees added successfully' })
  @Roles(Role.Admin)
  async addAssignees(
    @Param('id') id: string,
    @Body() addDto: AddAssigneesDto,
    @Query('organizationId') organizationId: string,
  ): Promise<Task> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.addAssignees(
      id,
      addDto.assigneeIds,
      organizationId,
    );
  }

  @Delete(':id/assignees/:assigneeId')
  @ApiOperation({ summary: 'Remove an assignee from a task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiParam({ name: 'assigneeId', description: 'Assignee ID to remove' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiResponse({ status: 200, description: 'Assignee removed successfully' })
  @Roles(Role.Admin)
  async removeAssignee(
    @Param('id') id: string,
    @Param('assigneeId') assigneeId: string,
    @Query('organizationId') organizationId: string,
  ): Promise<Task> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.removeAssignee(id, assigneeId, organizationId);
  }

  @Patch(':id/reassign')
  @ApiOperation({ summary: 'Reassign a task to new assignees' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: ReassignTaskDto })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiResponse({ status: 200, description: 'Task reassigned successfully' })
  @Roles(Role.Admin)
  async reassignTask(
    @Param('id') id: string,
    @Body() reassignTaskDto: ReassignTaskDto,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ): Promise<Task> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }
    const tenantId = this.tenantService.getTenantId();

    return this.taskService.reassignTask(
      id,
      reassignTaskDto.newAssigneeIds,
      tenantId,
    );
  }

  @Post('bulk-assign')
  @ApiOperation({ summary: 'Bulk assign multiple tasks to multiple users' })
  @ApiBody({ type: BulkAssignTasksDto })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk assignment completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'number' },
        failed: { type: 'number' },
        results: { type: 'array' },
      },
    },
  })
  @Roles(Role.Admin)
  async bulkAssignTasks(
    @Body() bulkDto: BulkAssignTasksDto,
    @Query('organizationId') organizationId: string,
  ): Promise<{ success: number; failed: number; results: any[] }> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.bulkAssignTasks(
      bulkDto.taskIds,
      bulkDto.assigneeIds,
      organizationId,
    );
  }

  // Advanced filtering and analytics endpoints

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get task analytics overview' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @Roles(Role.Admin, Role.Member)
  async getTaskAnalytics(
    @Query('organizationId') organizationId: string,
  ): Promise<any> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    // Get all tasks for analytics
    const allTasks =
      await this.taskService.getOrganizationTasks(organizationId);
    const workload = await this.taskService.getAssigneeWorkload(organizationId);

    // Calculate analytics
    const totalTasks = allTasks.length;
    const pendingTasks = allTasks.filter(
      (task) => task.status === TaskStatus.PENDING,
    ).length;
    const completedTasks = allTasks.filter(
      (task) => task.status === TaskStatus.COMPLETED,
    ).length;
    const canceledTasks = allTasks.filter(
      (task) => task.status === TaskStatus.CANCELED,
    ).length;

    const tasksByType = {
      review: allTasks.filter((task) => task.type === TaskType.REVIEW).length,
      publish: allTasks.filter((task) => task.type === TaskType.PUBLISH).length,
    };

    return {
      overview: {
        totalTasks,
        pendingTasks,
        completedTasks,
        canceledTasks,
        completionRate:
          totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
      },
      tasksByType,
      workloadDistribution: workload,
      totalAssignees: workload.length,
      averageTasksPerAssignee:
        workload.length > 0
          ? (
              workload.reduce((sum, w) => sum + w.pendingTasks, 0) /
              workload.length
            ).toFixed(2)
          : 0,
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search tasks with advanced filters' })
  @ApiQuery({
    name: 'organizationId',
    required: true,
    description: 'Organization ID',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Search query for title/description',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TaskStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TaskType,
    description: 'Filter by type',
  })
  @ApiQuery({
    name: 'assigneeId',
    required: false,
    description: 'Filter by assignee',
  })
  @ApiQuery({
    name: 'postId',
    required: false,
    description: 'Filter by post ID',
  })
  @Roles(Role.Admin, Role.Member)
  async searchTasks(
    @Query('organizationId') organizationId: string,
    @Query('query') searchQuery?: string,
    @Query('status') status?: TaskStatus,
    @Query('type') type?: TaskType,
    @Query('assigneeId') assigneeId?: string,
    @Query('postId') postId?: string,
  ): Promise<any[]> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    const filters: any = { organizationId };
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (postId) filters.postId = postId;

    let tasks;
    if (assigneeId) {
      tasks = await this.taskService.getTasksByAssignee(
        organizationId,
        assigneeId,
        filters,
      );
    } else {
      tasks = await this.taskService.getTasksWithAssigneeDetails(
        organizationId,
        filters,
      );
    }

    // Apply text search if query provided
    if (searchQuery) {
      const lowercaseQuery = searchQuery.toLowerCase();
      tasks = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(lowercaseQuery) ||
          (task.description &&
            task.description.toLowerCase().includes(lowercaseQuery)),
      );
    }

    return tasks;
  }
}
