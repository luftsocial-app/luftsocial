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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

import { Role, RoleGuard, Roles } from 'src/guards/role-guard';
import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';
import { TaskService } from '../services/task.service';
import { Task, TaskStatus } from '../entities/task.entity';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { CreateTaskDto } from '../helper/dto/create-task.dto';

class ReassignTaskDto {
  newAssigneeId: string;
}

@ApiTags('Tasks')
@Controller('tasks')
@UseGuards(RoleGuard, OrganizationAccessGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post('new')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiBody({ type: CreateTaskDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  @Roles(Role.Admin, Role.Member)
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: any,
  ): Promise<Task> {
    return this.taskService.createTask(createTaskDto, user.orgId, user.userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get tasks assigned to current user' })
  async getMyTasks(
    @Query('status') status: TaskStatus,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: any,
  ): Promise<Task[]> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.getUserTasks(user.id, organizationId, status);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'Get tasks for a specific post' })
  async getTasksByPost(
    @Param('postId') postId: string,
    @Query('status') status: TaskStatus,
    @Query('organizationId') organizationId: string,
    // @CurrentUser() user: any,
  ): Promise<Task[]> {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }

    return this.taskService.getTasksByPost(postId, organizationId, status);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed' })
  async completeTask(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<Task> {
    // In a real app, we'd check if the user can complete this task
    return this.taskService.completeTask(id, user.id);
  }

  @Patch(':id/reassign')
  @ApiOperation({ summary: 'Reassign a task to another organization member' })
  async reassignTask(
    @Param('id') id: string,
    @Body() reassignTaskDto: ReassignTaskDto,
    @CurrentUser() user: any,
  ): Promise<Task> {
    return this.taskService.reassignTask(
      id,
      reassignTaskDto.newAssigneeId,
      user.tenantId,
    );
  }
}
