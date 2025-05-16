import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { TaskType } from '../../entities/task.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'The title of the task',
    example: 'Review blog post content',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'A detailed description of the task',
    example: 'Please review the blog post for grammar and accuracy',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The type of task',
    enum: TaskType,
    example: TaskType.REVIEW,
  })
  @IsNotEmpty()
  @IsEnum(TaskType)
  type: TaskType;

  @ApiProperty({
    description: 'The ID of the user assigned to complete this task',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsNotEmpty()
  @IsUUID()
  assigneeId: string;

  @ApiProperty({
    description: 'The ID of the post that this task is for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiProperty({
    description: 'The ID of the approval step (if applicable)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  approvalStepId?: string;
}
