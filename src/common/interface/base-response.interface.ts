import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty({ example: null })
  error?: string;
}
