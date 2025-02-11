import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TikTokConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly baseUrl: string = 'https://open-api.tiktok.com/v2';
  readonly scopes: string[];

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get('TIKTOK_CLIENT_ID');
    this.clientSecret = this.configService.get('TIKTOK_CLIENT_SECRET');
    this.redirectUri = this.configService.get('TIKTOK_REDIRECT_URI');
    this.scopes = [
      'user.info.basic',
      'video.list',
      'video.upload',
      'comment.list',
      'comment.create',
    ];
  }
}
