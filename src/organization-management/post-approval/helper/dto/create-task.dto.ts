import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { TaskType } from '../../entities/task.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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
    description: 'Array of user IDs assigned to complete this task',
    example: [
      '123e4567-e89b-12d3-a456-426614174002',
      '123e4567-e89b-12d3-a456-426614174003',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  assigneeIds: string[];

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
