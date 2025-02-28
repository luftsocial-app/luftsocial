import { BadRequestException, Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import * as merge from 'lodash/merge';
import axios from 'axios';
import * as config from 'config';
import {
  MediaStorageItem,
  PreSignedUrlResult,
  UploadResult,
} from './media-storage.dto';
import { MediaType } from '../common/enums/media-type.enum';

@Injectable()
export class MediaStorageService {
  private _s3: S3;

  get s3() {
    return this._s3;
  }

  constructor() {
    this._s3 = new S3({
      region: config.get('AWS_REGION'),
      credentials: {
        accessKeyId: config.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    bucket: string = config.get('AWS_S3_BUCKET'),
    options?: S3.ManagedUpload.ManagedUploadOptions,
  ): Promise<UploadResult> {
    const defaultOptions: S3.ManagedUpload.ManagedUploadOptions = {
      queueSize: 10,
    };

    const mergedOptions = merge(defaultOptions, options);
    const sendData = await this.s3
      .upload(
        {
          Bucket: bucket,
          Key: key,
          Body: fileBuffer,
        },
        mergedOptions,
      )
      .promise();

    return {
      sendData,
      cdnUrl: `https://${bucket}.s3.${config.get('AWS_REGION')}.amazonaws.com/${key}`,
    };
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

  async createPreSignedUrl(
    key: string,
    contentType: string,
    bucket: string = config.get('AWS_S3_BUCKET'),
  ): Promise<PreSignedUrlResult> {
    const preSignedUrl = await this.s3.getSignedUrlPromise('putObject', {
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Expires: 360,
    });

    return {
      preSignedUrl,
      contentType,
      cdnUrl: `https://${bucket}.s3.${config.get('AWS_REGION')}.amazonaws.com/${key}`,
      bucket,
      key,
    };
  }
}
