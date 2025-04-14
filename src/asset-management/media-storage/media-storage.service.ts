import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { S3 } from 'aws-sdk';
import axios from 'axios';
import * as config from 'config';
import * as crypto from 'crypto';
import {
  MediaStorageItem,
  PreSignedUrlResult,
  UploadResult,
} from './media-storage.dto';
import { MediaType } from '../../common/enums/media-type.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { PostAsset } from '../entities/post-asset.entity';
import { SocialPlatform } from '../../common/enums/social-platform.enum';
import { TenantService } from '../../user-management/tenant/tenant.service';

@Injectable()
export class MediaStorageService {
  private readonly s3: S3;
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(
    @InjectRepository(PostAsset)
    private readonly postAssetRepository: Repository<PostAsset>,
    private readonly pinoLogger: PinoLogger,
    private tenantService: TenantService,
  ) {
    this.pinoLogger.setContext(MediaStorageService.name);

    this.s3 = new S3({
      region: config.get('aws.region'),
      credentials: {
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretAccessKey'),
      },
    });
  }

  private async uploadToS3(
    key: string,
    body: Buffer,
    contentType?: string,
    metadata?: Record<string, string>,
    bucket: string = config.get('aws.s3.bucket'),
  ): Promise<UploadResult> {
    this.logger.debug(`Uploading to S3: ${key}, content-type: ${contentType}`);

    try {
      const uploadParams: S3.PutObjectRequest = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ...(contentType && { ContentType: contentType }),
        ...(metadata && { Metadata: metadata }),
      };

      const result = await this.s3
        .upload(uploadParams, { queueSize: 10 })
        .promise();

      this.logger.debug(`Successfully uploaded to S3: ${key}`);

      return {
        sendData: result,
        cdnUrl: `https://${bucket}.s3.${config.get('aws.region')}.amazonaws.com/${key}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload to S3: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to upload to S3: ${error.message}`);
    }
  }

  /**
   * Calculate file hash for deduplication
   */
  async calculateFileHash(buffer: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Find media by hash
   */
  async findMediaByHash(hash: string): Promise<MediaStorageItem | null> {
    this.logger.debug(`Searching for media with hash ${hash}`);

    try {
      const asset = await this.postAssetRepository.findOne({
        where: { fileHash: hash },
      });

      if (!asset) {
        return null;
      }

      this.logger.debug(
        `Found existing media with hash ${hash}: ${asset.fileKey}`,
      );

      return {
        id: asset.id,
        url: `https://${config.get('aws.s3.bucket')}.s3.${config.get('aws.region')}.amazonaws.com/${asset.fileKey}`,
        key: asset.fileKey,
        type: this.getMediaTypeFromMimeType(asset.fileType),
        originalFilename: asset.fileName || 'file',
        size: asset.fileSize || 0,
        mimeType: asset.fileType,
        hash: asset.fileHash,
      };
    } catch (error) {
      this.logger.error(
        `Error finding media by hash: ${error.message}`,
        error.stack,
      );
      return null; // Return null rather than throwing to allow upload to continue
    }
  }

  /**
   * Upload multiple files for a post
   */
  async uploadPostMedia(
    userId: string,
    files: Express.Multer.File[],
    postId?: string,
    platform?: SocialPlatform,
    fileHash?: string,
  ): Promise<MediaStorageItem[]> {
    this.logger.log(`Uploading ${files.length} files for user ${userId}`);

    const mediaItems = await Promise.all(
      files.map(async (file) => {
        try {
          // Calculate hash if not provided
          const hash = fileHash || (await this.calculateFileHash(file.buffer));

          // Check for existing file with same hash
          const existingMedia = await this.findMediaByHash(hash);
          if (existingMedia) {
            this.logger.log(`Using existing media with hash ${hash}`);

            // Save a reference to the existing media for this post
            await this.saveFile(
              userId,
              existingMedia.key,
              existingMedia.mimeType,
              hash,
              file.originalname,
              file.size,
              postId,
            );

            return existingMedia;
          }

          // Upload new file
          const key = this.generatePostMediaKey(
            userId,
            file.originalname,
            postId,
            platform,
          );

          const uploadResult = await this.uploadToS3(
            key,
            file.buffer,
            file.mimetype,
            { 'file-hash': hash },
          );

          // Save file metadata
          const savedFile = await this.saveFile(
            userId,
            key,
            file.mimetype,
            hash,
            file.originalname,
            file.size,
            postId,
          );

          return {
            id: savedFile.id,
            url: uploadResult.cdnUrl,
            key,
            type: this.getMediaType(file.mimetype),
            originalFilename: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            hash,
          };
        } catch (error) {
          this.logger.error(
            `Failed to upload file ${file.originalname}: ${error.message}`,
            error.stack,
          );
          throw new BadRequestException(
            `Failed to upload file: ${error.message}`,
          );
        }
      }),
    );

    return mediaItems;
  }

  /**
   * Upload media from a URL
   */
  async uploadMediaFromUrl(
    userId: string,
    url: string,
    postId?: string,
    platform?: SocialPlatform,
    enableDeduplication: boolean = true,
  ): Promise<MediaStorageItem> {
    this.logger.log(`Uploading media from URL for user ${userId}: ${url}`);

    try {
      const { data, headers } = await axios.get(url, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(data);
      const originalFilename = this.getFilenameFromUrl(url);
      const mimetype = headers['content-type'];

      // Calculate hash for deduplication
      let hash: string | undefined;
      let existingMedia: MediaStorageItem | null = null;

      if (enableDeduplication) {
        hash = await this.calculateFileHash(buffer);
        existingMedia = await this.findMediaByHash(hash);

        if (existingMedia) {
          this.logger.log(
            `Using existing media with hash ${hash} from URL ${url}`,
          );

          // Save a reference to the existing media for this post
          await this.saveFile(
            userId,
            existingMedia.key,
            existingMedia.mimeType,
            hash,
            originalFilename,
            buffer.length,
            postId,
          );

          return existingMedia;
        }
      }

      // Upload new file
      const key = this.generatePostMediaKey(
        userId,
        originalFilename,
        postId,
        platform,
      );

      const uploadResult = await this.uploadToS3(
        key,
        buffer,
        mimetype,
        hash ? { 'file-hash': hash } : undefined,
      );

      // Save file metadata
      const savedFile = await this.saveFile(
        userId,
        key,
        mimetype,
        hash,
        originalFilename,
        buffer.length,
        postId,
      );

      return {
        id: savedFile.id,
        url: uploadResult.cdnUrl,
        key,
        type: this.getMediaType(mimetype),
        originalFilename,
        size: buffer.length,
        mimeType: mimetype,
        hash,
      };
    } catch (error) {
      this.logger.error(
        `Failed to download media from URL ${url}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to download media: ${error.message}`,
      );
    }
  }

  /**
   * Generate pre-signed URL for direct upload
   */
  async generatePreSignedUrl(
    userId: string,
    fileName: string,
    contentType: string,
    fileHash?: string,
    platform?: SocialPlatform,
  ): Promise<PreSignedUrlResult> {
    this.logger.log(
      `Generating pre-signed URL for ${fileName}, type ${contentType}`,
    );

    if (!fileName || !contentType) {
      throw new BadRequestException('File name and content type are required');
    }

    const isValidFileName = /^[a-zA-Z0-9._-]+$/.test(fileName);
    const isValidContentType =
      /^(image|video|audio|application)\/[a-zA-Z0-9+.-]+$/.test(contentType);

    if (!isValidFileName || !isValidContentType) {
      throw new BadRequestException('Invalid file name or content type');
    }

    const bucket: string = config.get('aws.s3.bucket');
    const tenantId: string = this.tenantService.getTenantId();
    const key = this.generatePostMediaKey(
      userId,
      fileName,
      undefined,
      tenantId,
      platform,
    );

    // Add metadata for deduplication if hash is provided
    const metadata: Record<string, string> = {};
    if (fileHash) {
      metadata['file-hash'] = fileHash;
    }

    const preSignedUrl = await this.s3.getSignedUrlPromise('putObject', {
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
      Expires: 360,
    });

    if (!preSignedUrl) {
      throw new BadRequestException('Failed to generate pre-signed URL');
    }

    this.logger.log(`Generated pre-signed URL for ${fileName}`);

    // Save metadata for the future upload
    const asset = await this.saveFile(
      tenantId,
      key,
      contentType,
      fileHash,
      fileName,
      undefined,
      undefined,
      true, // This is a pending upload
    );

    return {
      preSignedUrl,
      cdnUrl: `https://${bucket}.s3.${config.get('aws.region')}.amazonaws.com/${key}`,
      bucket,
      key,
      assetId: asset.id,
    };
  }

  /**
   * Update asset status after pre-signed URL upload completes
   */
  async finalizePendingUpload(
    assetId: string,
    size: number,
  ): Promise<MediaStorageItem> {
    this.logger.log(`Finalizing pending upload for asset ID ${assetId}`);

    const asset = await this.postAssetRepository.findOne({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${assetId} not found`);
    }

    // Update asset
    asset.isPending = false;
    asset.fileSize = size;
    asset.uploadedAt = new Date();

    await this.postAssetRepository.save(asset);

    return {
      id: asset.id,
      url: `https://${config.get('aws.s3.bucket')}.s3.${config.get('aws.region')}.amazonaws.com/${asset.fileKey}`,
      key: asset.fileKey,
      type: this.getMediaTypeFromMimeType(asset.fileType),
      originalFilename: asset.fileName || 'file',
      size: size,
      mimeType: asset.fileType,
      hash: asset.fileHash,
    };
  }

  /**
   * Verify upload after pre-signed URL is used
   */
  async verifyUpload(key: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: config.get('aws.s3.bucket'),
          Key: key,
        })
        .promise();

      return true;
    } catch (error) {
      this.logger.error(
        `File verification failed for ${key}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Generate a unique key for the uploaded media
   */
  private generatePostMediaKey(
    userId: string,
    filename: string,
    postId?: string,
    tenantId?: string,
    platform?: SocialPlatform,
  ): string {
    const extension = this.getFileExtension(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);

    const parts = ['social-media'];
    if (platform) parts.push(platform);
    if (tenantId) parts.push(tenantId);
    parts.push(userId);
    if (postId) parts.push(postId);
    parts.push(`${timestamp}-${random}.${extension}`);

    return parts.filter(Boolean).join('/');
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || 'bin';
  }

  private getMediaType(mimetype: string): MediaType {
    return this.getMediaTypeFromMimeType(mimetype);
  }

  private getMediaTypeFromMimeType(mimetype: string): MediaType {
    if (mimetype.startsWith('image/')) return MediaType.IMAGE;
    if (mimetype.startsWith('video/')) return MediaType.VIDEO;
    if (mimetype.startsWith('audio/')) return MediaType.AUDIO;
    return MediaType.FILE;
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const { pathname } = new URL(url);
      return pathname.split('/').pop() || `file-${Date.now()}`;
    } catch {
      return `file-${Date.now()}`;
    }
  }

  /**
   * Save file metadata to database
   */
  async saveFile(
    userId: string,
    key: string,
    contentType: string,
    fileHash?: string,
    fileName?: string,
    fileSize?: number,
    postId?: string,
    isPending: boolean = false,
  ) {
    this.logger.debug(`Saving file metadata for ${key}`);

    try {
      const upload = this.postAssetRepository.create({
        tenantId: userId,
        fileKey: key,
        fileType: contentType,
        fileHash,
        fileName,
        fileSize,
        postId,
        isPending,
        uploadedAt: new Date(),
      });

      const saved = await this.postAssetRepository.save(upload);
      this.logger.debug(`Saved file metadata: ${JSON.stringify(saved)}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to save file metadata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get tenant uploads
   */
  async getTenantUploads(tenantId: string) {
    return this.postAssetRepository.find({ where: { tenantId } });
  }

  /**
   * Get uploads for a specific post
   */
  async getPostUploads(postId: string) {
    return this.postAssetRepository.find({ where: { postId } });
  }
}
