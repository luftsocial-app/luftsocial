import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';

import { CurrentUser } from 'src/decorators/current-user.decorator';
import { OrganizationAccessGuard } from 'src/guards/organization-access.guard';
import { RoleGuard } from 'src/guards/role-guard';
import { ApprovePostDto } from '../helper/dto/approve-post.dto';
import { ApproveStepCommand } from '../commands/approve-step.command';
import { RejectPostDto } from '../helper/dto/reject-post.dto';
import { RejectStepCommand } from '../commands/reject-step.command';
import { PublishPostDto } from '../helper/dto/publish-post.dto';
import { PostResponseDto } from '../helper/dto/post-response.dto';
import { PublishPostCommand } from '../commands/publish-post.command';

@ApiTags('Post Approval Workflow')
@Controller('posts')
@UseGuards(RoleGuard, OrganizationAccessGuard)
export class ApprovalController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':postId/steps/:stepId/approve')
  @ApiOperation({ summary: 'Approve an approval step' })
  async approveStep(
    @Param('postId') postId: string,
    @Param('stepId') stepId: string,
    @Body() approvePostDto: ApprovePostDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    // Extract the user's role
    const userRole = user.roles[0];

    const command = new ApproveStepCommand(
      postId,
      stepId,
      approvePostDto,
      user.id,
      userRole,
      user.tenantId,
    );

    return this.commandBus.execute(command);
  }

  @Post(':postId/steps/:stepId/reject')
  @ApiOperation({ summary: 'Reject an approval step' })
  async rejectStep(
    @Param('postId') postId: string,
    @Param('stepId') stepId: string,
    @Body() rejectPostDto: RejectPostDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    // Extract the user's role
    const userRole = user.roles[0];

    const command = new RejectStepCommand(
      postId,
      stepId,
      rejectPostDto,
      user.id,
      userRole,
      user.tenantId,
    );

    return this.commandBus.execute(command);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish an approved post' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    }),
  )
  async publishPost(
    @Param('id') id: string,
    @Body() publishPostDto: PublishPostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ): Promise<PostResponseDto> {
    // Extract the user's role
    const userRole = user.roles[0];

    const command = new PublishPostCommand(
      id,
      publishPostDto,
      user.id,
      userRole,
      user.tenantId,
      files,
    );

    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }
}
