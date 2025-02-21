import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TikTokConfig {
  readonly clientKey: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly baseUrl: string = 'https://open.tiktokapis.com/v2';
  readonly scopes: string[];

  constructor(private configService: ConfigService) {
    this.clientKey = this.configService.get('TIKTOK_CLIENT_KEY');
    this.clientSecret = this.configService.get('TIKTOK_CLIENT_SECRET');
    this.redirectUri = this.configService.get('TIKTOK_REDIRECT_URI');
    this.scopes = [
      'user.info.basic', // For reading user profile info
      'user.info.profile', // For additional profile info like bio, verified status
      'user.info.stats', // For user statistics (likes, followers, etc)
      'video.list', // For reading user's public videos
      'video.publish', // For directly posting content
      'video.upload', // For creating drafts
    ];
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(','),
      state: state,
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  getTokenEndpoint(): string {
    return `${this.baseUrl}/oauth/token/`;
  }

  getRevokeEndpoint(): string {
    return `${this.baseUrl}/oauth/revoke/`;
  }
}
