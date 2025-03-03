import { Injectable } from '@nestjs/common';
import * as config from 'config';

import { FACEBOOK_SCOPES } from '../../../common/enums/scopes.enum';
import { PlatformConfig } from '../../platform-config.interface';

@Injectable()
export class FacebookConfig implements PlatformConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: string[];
  readonly apiVersion: string;

  constructor() {
    this.clientId = config.get<string>('platforms.facebook.clientId');
    this.clientSecret = config.get<string>('platforms.facebook.clientSecret');
    this.redirectUri = config.get<string>('platforms.facebook.redirectUri');
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
