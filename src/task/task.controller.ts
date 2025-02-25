import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { CreateTaskDto, UpdateTaskDto } from './dto/TaskDto';
import { TaskService } from './task.service';

@Controller('tasks')
export class TaskController {
  constructor(private readonly TaskService: TaskService) {}

  @Get()
  getTasks(@Req() req: Request) {
    return this.TaskService.getAll(req['tenantId']);
  }

  @Post()
  createTask(@Req() req: Request, @Body() data: CreateTaskDto) {
    this.TaskService.create(data, req['tenantId']);
    return HttpStatus.CREATED;
  }

  @Get('/:uuid')
  getTask(@Req() req: Request, @Param('uuid') uuid: string) {
    return this.TaskService.get(uuid, req['tenantId']);
  }

  @Put('/:uuid')
  updateTask(
    @Req() req: Request,
    @Param('uuid') uuid: string,
    @Body() data: UpdateTaskDto,
  ) {
    this.TaskService.update(uuid, data, req['tenantId']);
    return HttpStatus.NO_CONTENT;
  }

  @Delete('/:uuid')
  deleteTask(@Req() req: Request, @Param('uuid') uuid: string) {
    this.TaskService.delete(uuid, req['tenantId']);
    return HttpStatus.ACCEPTED;
  }
}
