import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { Stream } from 'stream';

export class LinkedInMediaUtil {
  static async downloadMedia(url: string): Promise<{
    stream: Stream;
    contentType: string;
    size: number;
  }> {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        maxContentLength: 5 * 1024 * 1024, // 5MB limit
      });

      return {
        stream: response.data,
        contentType: response.headers['content-type'],
        size: parseInt(response.headers['content-length'] || '0'),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to download media',
        HttpStatus.BAD_REQUEST,
        error,
      );
    }
  }

  static validateMediaType(contentType: string): string {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (!allowedTypes.includes(contentType)) {
      throw new HttpException(
        'Invalid media type. Only JPEG, PNG, and GIF are supported.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return contentType;
  }
}
