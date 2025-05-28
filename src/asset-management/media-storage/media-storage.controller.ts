import { Controller, Get, ParseEnumPipe, Query } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { MediaStorageService } from './media-storage.service';
import { AuthObject } from '@clerk/express';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { UploadType } from '../../common/enums/upload.enum';

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
    @Query('fileHash') fileHash: string,
    @Query('platform', new ParseEnumPipe(SocialPlatform))
    @Query('uploadType', new ParseEnumPipe(UploadType))
    uploadType: UploadType = UploadType.POST,
    platform: SocialPlatform,
  ) {
    return await this.mediaStorageService.generatePreSignedUrl(
      user.userId,
      fileName,
      fileType,
      fileHash,
      platform,
      uploadType,
    );
  }

  @Get('tenant-post-assets')
  async getTenantUploads(@CurrentUser() user: AuthObject) {
    const tenantId = user.orgId;
    return this.mediaStorageService.getTenantUploads(tenantId);
  }
}
