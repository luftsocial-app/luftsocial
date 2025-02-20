import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FACEBOOK_SCOPES } from 'src/enum/scopes.enum';
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
      FACEBOOK_SCOPES.PAGES_SHOW_LIST,
      FACEBOOK_SCOPES.PAGES_READ_ENGAGEMENT,
      FACEBOOK_SCOPES.PAGES_MANAGE_POSTS,
      FACEBOOK_SCOPES.PAGES_MANAGE_METADATA,
      FACEBOOK_SCOPES.PAGES_READ_USER_CONTENT,
    ];
  }
}
