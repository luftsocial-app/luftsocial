import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformConfig } from 'src/platforms/platform-config.interface';

@Injectable()
export class FacebookConfig implements PlatformConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: string[];
  readonly apiVersion: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('FACEBOOK_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'FACEBOOK_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.get<string>('FACEBOOK_REDIRECT_URI');
    this.apiVersion = 'v18.0';
    this.scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_metadata',
      'pages_read_user_content',
    ];
  }
}
