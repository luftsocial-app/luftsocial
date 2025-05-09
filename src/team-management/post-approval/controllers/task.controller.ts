import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Request,
  Query,
  Post,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TaskService } from '../services/task.service';
import { Task, TaskStatus } from '../entities/task.entity';
import { ReassignTaskDto } from '../helper/dto/reassign-task.dto';
import { CreateTaskDto } from '../helper/dto/create-task.dto';
import { UserService } from 'src/user-management/user.service';

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly userService: UserService,
  ) {}

  @Post()
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req,
  ): Promise<Task> {
    const { teamId } = req.user;
    const tenantId = req.tenantId;

    return this.taskService.createTask(createTaskDto, teamId, tenantId);
  }
  @Get('post/:postId')
  async getTasksByPost(
    @Param('postId') postId: string,
    @Query('status') status: TaskStatus,
    @Request() req,
  ): Promise<Task[]> {
    const { teamId } = req.user;

    return this.taskService.getTasksByPost(postId, teamId, status);
  }

  @Get('my')
  async getMyTasks(
    @Query('status') status: TaskStatus,
    @Query('teamId') teamId: string,
    @Request() req,
  ): Promise<Task[]> {
    const { userId } = req.user;

    if (!teamId) {
      throw new BadRequestException('teamId query parameter is required');
    }
    // Verify user belongs to the team
    const userInTeam = await this.userService.checkUserInTeam(userId, teamId);

    if (!userInTeam) {
      throw new ForbiddenException('User is not a member of this team');
    }

    return this.taskService.getUserTasks(userId, teamId, status);
  }
  @Get('team')
  async getTeamTasks(
    @Query('status') status: TaskStatus,
    @Request() req,
  ): Promise<Task[]> {
    const { teamId } = req.user;

    return this.taskService.getTeamTasks(teamId, status);
  }

  @Patch(':id/complete')
  async completeTask(@Param('id') id: string, @Request() req): Promise<Task> {
    const { userId } = req.user;

    return this.taskService.completeTask(id, userId);
  }

  @Patch(':id/reassign')
  async reassignTask(
    @Param('id') id: string,
    @Body() reassignTaskDto: ReassignTaskDto,
    @Request() req,
  ): Promise<Task> {
    const tenantId = req.tenantId;

    return this.taskService.reassignTask(
      id,
      reassignTaskDto.newAssigneeId,
      tenantId,
    );
  }
}
