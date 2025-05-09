import { IsNotEmpty, IsUUID } from 'class-validator';

export class ReassignTaskDto {
  @IsNotEmpty()
  @IsUUID()
  newAssigneeId: string;
}
