import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { MediaStorageService } from './media-storage.service';
import { AuthObject } from '@clerk/express';
import { CurrentUser } from '../../decorators/current-user.decorator';

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

    return await this.mediaStorageService.createPreSignedUrl(
      fileName,
      fileType,
      tenantId,
    );
  }

  @Get('tenant-posts')
  async getTenantUploads(@CurrentUser() user: AuthObject) {
    const tenantId = user.orgId;
    return this.mediaStorageService.getTenantUploads(tenantId);
  }
}
