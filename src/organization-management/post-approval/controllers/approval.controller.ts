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
import { TenantService } from 'src/user-management/tenant.service';

@ApiTags('Post Approval Workflow')
@Controller('post-approval')
@UseGuards(RoleGuard, OrganizationAccessGuard)
export class ApprovalController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tenantService: TenantService,
  ) {}

  @Post(':postId/steps/approve-multiple')
  async approveMultipleSteps(
    @Param('postId') postId: string,
    @Body() approveMultipleDto: { stepIds: string[]; comment?: string },
    @CurrentUser() user: any,
  ) {
    const tenantId = this.tenantService.getTenantId();

    const command = new ApproveStepCommand(
      postId,
      approveMultipleDto.stepIds, // Array of step IDs
      { comment: approveMultipleDto.comment },
      user.userId,
      user.orgRole,
      tenantId,
    );

    return await this.commandBus.execute(command);
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

    const tenantId = this.tenantService.getTenantId();

    const command = new RejectStepCommand(
      postId,
      stepId,
      rejectPostDto,
      user.userId,
      userRole,
      tenantId,
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
    const tenantId = this.tenantService.getTenantId();

    const command = new PublishPostCommand(
      id,
      publishPostDto,
      user.userId,
      userRole,
      tenantId,
      files,
    );

    const post = await this.commandBus.execute(command);
    return new PostResponseDto(post);
  }
}
