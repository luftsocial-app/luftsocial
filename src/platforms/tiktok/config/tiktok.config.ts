import { Injectable } from '@nestjs/common';
import * as config from 'config';
import { TIKTOK_SCOPES } from '../../../common/enums/scopes.enum';

@Injectable()
export class TikTokConfig {
  readonly clientKey: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly baseUrl: string = 'https://open.tiktokapis.com/v2';
  readonly scopes: string[];

  constructor() {
    this.clientKey = config.get('platforms.tiktok.clientKey');
    this.clientSecret = config.get('platforms.tiktok.clientSecret');
    this.redirectUri = config.get('platforms.tiktok.redirectUri');
    this.scopes = [
      TIKTOK_SCOPES.BASIC_INFO,
      TIKTOK_SCOPES.PROFILE_INFO,
      TIKTOK_SCOPES.USER_INFO_STATS,
      TIKTOK_SCOPES.VIDEO_LIST,
      TIKTOK_SCOPES.VIDEO_PUBLISH,
      TIKTOK_SCOPES.VIDEO_UPLOAD,
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
