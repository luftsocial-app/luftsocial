import { BadRequestException, Injectable } from '@nestjs/common';
import * as merge from 'lodash/merge';
import axios from 'axios';
import * as config from 'config';
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
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class MediaStorageService {
  private s3: S3Client;

  constructor(
    @InjectRepository(PostAsset)
    private readonly postAssetRepository: Repository<PostAsset>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MediaStorageService.name);

    this.s3 = new S3Client({
      region: config.get('aws.region'),
      credentials: {
        accessKeyId: config.get('aws.accessKeyId'),
        secretAccessKey: config.get('aws.secretAccessKey'),
      },
    });
  }

  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    bucket: string = config.get('aws.s3.bucket'),
    options?: any,
  ): Promise<UploadResult> {
    const defaultOptions: any = {
      queueSize: 10,
    };

    const mergedOptions = merge(defaultOptions, options);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ...mergedOptions,
    });

    try {
      const sendData = await this.s3.send(command);
      return {
        sendData,
        cdnUrl: `https://${bucket}.s3.${config.get('aws.region')}.amazonaws.com/${key}`,
      };
    } catch (error) {
      console.log({ error });

      throw new BadRequestException('Failed to upload to S3');
    }
  }

  async uploadPostMedia(
    userId: string,
    files: Express.Multer.File[],
    postId?: string,
  ): Promise<MediaStorageItem[]> {
    const mediaItems: MediaStorageItem[] = [];

    for (const file of files) {
      // Generate a unique key for each file
      const key = this.generatePostMediaKey(userId, file.originalname, postId);

      // Determine media type
      const mediaType = this.getMediaType(file.mimetype);

      // Upload to S3
      const uploadResult = await this.uploadFile(key, file.buffer, {
        ...(file.mimetype && ({ ContentType: file.mimetype } as any)),
      });

      // Store media info
      const mediaItem: MediaStorageItem = {
        url: uploadResult.cdnUrl,
        key,
        type: mediaType,
        originalFilename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      };

      mediaItems.push(mediaItem);
    }

    return mediaItems;
  }

  async uploadMediaFromUrl(
    userId: string,
    url: string,
    postId?: string,
  ): Promise<MediaStorageItem> {
    try {
      // Download file from URL
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      // Get filename from URL or generate one
      const originalFilename = this.getFilenameFromUrl(url);
      const mimetype = response.headers['content-type'];

      // Generate key
      const key = this.generatePostMediaKey(userId, originalFilename, postId);

      // Upload to S3
      const uploadResult = await this.uploadFile(key, buffer, {
        ContentType: mimetype,
      } as any);

      return {
        url: uploadResult.cdnUrl,
        key,
        type: this.getMediaType(mimetype),
        originalFilename,
        size: buffer.length,
        mimeType: mimetype,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to download media from URL: ${error.message}`,
      );
    }
  }

  private generatePostMediaKey(
    userId: string,
    filename: string,
    postId?: string,
  ): string {
    const extension = this.getFileExtension(filename);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);

    const keyParts = ['social-media', userId];
    if (postId) keyParts.push(postId);
    keyParts.push(`${timestamp}-${randomString}.${extension}`);

    return keyParts.join('/');
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || 'bin';
  }

  private getMediaType(mimetype: string): MediaType {
    if (mimetype.startsWith('image/')) {
      return MediaType.IMAGE;
    }
    if (mimetype.startsWith('video/')) {
      return MediaType.VIDEO;
    }
    if (mimetype.startsWith('audio/')) {
      return MediaType.AUDIO;
    }
    return MediaType.FILE;
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const { pathname } = new URL(url);
      const filename = pathname.split('/').pop() || '';
      return filename || `file-${Date.now()}`;
    } catch {
      return `file-${Date.now()}`;
    }
  }

  async generatePreSignedUrl(
    fileName: string,
    contentType: string,
    tenantId: string,
  ): Promise<PreSignedUrlResult> {
    if (!fileName || !contentType) {
      throw new BadRequestException('File name and content type are required');
    }

    // Validate file name and content type
    const validFileName = /^[a-zA-Z0-9._-]+$/.test(fileName);
    const validContentType =
      /^(image|video|audio|application)\/[a-zA-Z0-9+.-]+$/.test(contentType);
    if (!validFileName || !validContentType) {
      throw new BadRequestException('Invalid file name or content type format');
    }

    const bucket: string = config.get('aws.s3.bucket');
    const key = `uploads/${tenantId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    // Generate the pre-signed URL
    const preSignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 3600,
    });

    if (!preSignedUrl) {
      throw new BadRequestException('Failed to generate pre-signed URL');
    }

    this.logger.info(
      `Generated pre-signed URL: ${preSignedUrl} for file: ${fileName}`,
      MediaStorageService.name,
    );

    // Save file metadata to database (optional)
    await this.saveFile(tenantId, key, contentType);

    return {
      preSignedUrl,
      cdnUrl: `https://${bucket}.s3.${config.get('aws.region')}.amazonaws.com/${key}`,
      bucket,
      key,
    };
  }

  async saveFile(tenantId: string, key: string, ContentType: string) {
    const upload = this.postAssetRepository.create({
      tenantId,
      fileKey: key,
      fileType: ContentType,
      uploadedAt: new Date(),
    });

    await this.postAssetRepository.save(upload);

    this.logger.info(
      `File metadata saved: ${JSON.stringify(upload)}`,
      MediaStorageService.name,
    );
    return upload;
  }

  async getTenantUploads(tenantId: string) {
    return this.postAssetRepository.find({ where: { tenantId } });
  }

  async generateViewURL(userId: string, key: string) {
    if (!key.startsWith(`users/${userId}/`)) throw new Error('Unauthorized');

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { url };
  }

  async generateDownloadURL(userId: string, key: string) {
    if (!key.startsWith(`users/${userId}/`)) throw new Error('Unauthorized');

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: 'attachment',
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { url };
  }
}
