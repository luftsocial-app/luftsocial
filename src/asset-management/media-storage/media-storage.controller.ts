import { Controller, Get, Query } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { MediaStorageService } from './media-storage.service';
import { AuthObject } from '@clerk/express';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// s3.controller.ts

@ApiTags('Media Storage')
@ApiBearerAuth()
@Controller('uploads')
export class MediaStorageController {
  constructor(
    private readonly mediaStorageService: MediaStorageService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MediaStorageController.name);
  }

  @Get('presigned-url')
  async getPresignedUrl(
    @CurrentUser() user: AuthObject,
    @Query('fileName') fileName: string,
    @Query('mimeType') fileType: string,
  ) {
    const tenantId = user.orgId;

    return await this.mediaStorageService.generatePreSignedUrl(
      fileName,
      fileType,
      tenantId,
    );
  }

  @Get('tenant-post-assets')
  async getTenantUploads(@CurrentUser() user: AuthObject) {
    const tenantId = user.orgId;
    return this.mediaStorageService.getTenantUploads(tenantId);
  }

  @Get('view-url')
  async getViewUrl(@CurrentUser() user: AuthObject, @Query('key') key: string) {
    return this.mediaStorageService.generateViewURL(user.userId, key);
  }

  @Get('download-url')
  async getDownloadUrl(
    @CurrentUser() user: AuthObject,
    @Query('key') key: string,
  ) {
    return this.mediaStorageService.generateDownloadURL(user.userId, key);
  }
}
