import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IService } from '../common/interface/app.interface';
import { CreateTaskDto, UpdateTaskDto } from './dto/TaskDto';
import { TaskModel } from './TaskModel';

@Injectable()
export class TaskService
  implements IService<TaskModel, CreateTaskDto, UpdateTaskDto>
{
  private readonly Tasks: TaskModel[] = []; // temp local databse to store all our Task items

  create(data: CreateTaskDto, tenantId?: string): void {
    const uuid = randomUUID();
    const newTask = new TaskModel(uuid, data.title, data.done);
    if (tenantId) newTask.setTenantId(tenantId);
    this.Tasks.push(newTask);
  }

  delete(uuid: string, tenantId?: string) {
    const index = this.Tasks.findIndex((Task) => Task.uuid === uuid);
    if (index === -1) throw new NotFoundException('Task not found');
    if (tenantId && this.Tasks[index].tenantId !== tenantId)
      throw new NotFoundException('Task not found');
    this.Tasks.splice(index, 1);
  }

  get(uuid: string, tenantId?: string): TaskModel {
    const Task = this.Tasks.find((Task) => Task.uuid === uuid);
    if (!Task) throw new NotFoundException('Task not found');
    if (tenantId && Task.tenantId !== tenantId)
      throw new NotFoundException('Task not found');
    return Task;
  }

  update(uuid: string, data: UpdateTaskDto, tenantId?: string): TaskModel {
    const Task = this.Tasks.find((Task) => Task.uuid === uuid);
    if (!Task) throw new NotFoundException('Task not found');
    if (tenantId && Task.tenantId !== tenantId)
      throw new NotFoundException('Task not found');
    Task.title = data.title;
    Task.done = data.done;
    return Task;
  }

  getAll(tenantId?: string): TaskModel[] {
    if (tenantId)
      return this.Tasks.filter((Task) => Task.tenantId === tenantId);
    return this.Tasks.filter((Task) => !Task.tenantId);
  }
}
