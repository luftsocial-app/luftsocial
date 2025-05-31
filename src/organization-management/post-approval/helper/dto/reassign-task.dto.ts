import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class ReassignTaskDto {
  @ApiProperty({
    description: 'Array of user IDs to assign to the task',
    example: ['user1', 'user2', 'user3'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  newAssigneeIds: string[];
}

export class UpdateTaskAssigneesDto {
  @ApiProperty({
    description: 'Array of user IDs to assign to the task',
    example: ['user1', 'user2', 'user3'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assigneeIds: string[];
}
export class AddAssigneesDto {
  @ApiProperty({
    description: 'Array of user IDs to add to the task',
    example: ['user4', 'user5'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assigneeIds: string[];
}

export class BulkAssignTasksDto {
  @ApiProperty({
    description: 'Array of task IDs to assign',
    example: ['task1', 'task2', 'task3'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  taskIds: string[];

  @ApiProperty({
    description: 'Array of user IDs to assign to all tasks',
    example: ['user1', 'user2'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assigneeIds: string[];
}
