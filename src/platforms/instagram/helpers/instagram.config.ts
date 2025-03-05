import { Injectable } from '@nestjs/common';
import * as config from 'config';

import {
  INSTAGRAM_SCOPES,
  FACEBOOK_SCOPES,
} from '../../../common/enums/scopes.enum';

@Injectable()
export class InstagramConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: string[];
  readonly apiVersion: string;

  constructor() {
    this.clientId = config.get<string>('platforms.instagram.clientId');
    this.clientSecret = config.get<string>('platforms.instagram.clientSecret');
    this.redirectUri = config.get<string>('platforms.instagram.redirectUri');
    this.apiVersion = config.get<string>('platforms.instagram.apiVersion');
    this.scopes = [
      INSTAGRAM_SCOPES.BASIC,
      INSTAGRAM_SCOPES.CONTENT_PUBLISH,
      INSTAGRAM_SCOPES.MANAGE_COMMENTS,
      INSTAGRAM_SCOPES.MANAGE_INSIGHTS,
      FACEBOOK_SCOPES.PAGES_READ_ENGAGEMENT,
      FACEBOOK_SCOPES.PAGES_SHOW_LIST,
      FACEBOOK_SCOPES.PAGES_MANAGE_POSTS,
    ];
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(','),
      response_type: 'code',
      state: state,
    });

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
  }
}
