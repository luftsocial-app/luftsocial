import { Controller, Post, Body, Param, Request } from '@nestjs/common';
import { ApprovalService } from '../services/approval.service';
import { Post as PostEntity } from '../entities/post.entity';
import { ApprovePostDto } from '../helper/dto/approve-post.dto';
import { RejectPostDto } from '../helper/dto/reject-post.dto';
import { SchedulePostDto } from '../helper/dto/schedule-post.dto';

@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('posts/:postId/steps/:stepId/approve')
  async approveStep(
    @Param('postId') postId: string,
    @Param('stepId') stepId: string,
    @Body() approvePostDto: ApprovePostDto,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId, roles } = req.user;
    const tenantId = req.tenantId;

    // Extract the user's role - in a real app, you would have proper role handling
    // For simplicity, we'll just use the first role
    const userRole = roles[0];

    return this.approvalService.approveStep(
      postId,
      stepId,
      approvePostDto,
      userId,
      userRole,
      tenantId,
    );
  }

  @Post('posts/:postId/steps/:stepId/reject')
  async rejectStep(
    @Param('postId') postId: string,
    @Param('stepId') stepId: string,
    @Body() rejectPostDto: RejectPostDto,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId, roles } = req.user;
    const tenantId = req.tenantId;

    // Extract the user's role
    const userRole = roles[0];

    return this.approvalService.rejectStep(
      postId,
      stepId,
      rejectPostDto,
      userId,
      userRole,
      tenantId,
    );
  }

  @Post('posts/:postId/publish')
  async publishPost(
    @Param('postId') postId: string,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId, roles } = req.user;
    const tenantId = req.tenantId;

    // Extract the user's role
    const userRole = roles[0];

    return this.approvalService.publishPost(postId, userId, userRole, tenantId);
  }

  @Post('posts/:postId/schedule')
  async schedulePost(
    @Param('postId') postId: string,
    @Body() schedulePostDto: SchedulePostDto,
    @Request() req,
  ): Promise<PostEntity> {
    const { userId, roles } = req.user;
    const tenantId = req.tenantId;

    // Extract the user's role
    const userRole = roles[0];

    return this.approvalService.schedulePost(
      postId,
      schedulePostDto.scheduledDate,
      userId,
      userRole,
      tenantId,
    );
  }
}
