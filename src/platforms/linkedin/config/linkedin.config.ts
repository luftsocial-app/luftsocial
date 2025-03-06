import { Injectable } from '@nestjs/common';
import { LINKEDIN_SCOPES } from '../../../common/enums/scopes.enum';
import * as config from 'config';

@Injectable()
export class LinkedInConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: string[];
  readonly apiVersion: string;

  constructor() {
    this.clientId = config.get<string>('platforms.linkedin.clientId');
    this.clientSecret = config.get<string>('platforms.linkedin.clientSecret');
    this.redirectUri = config.get<string>('platforms.linkedin.redirectUri');
    this.apiVersion = 'v2';
    this.scopes = [
      LINKEDIN_SCOPES.W_MEMBER_SOCIAL,
      LINKEDIN_SCOPES.R_ORGANIZATION_SOCIAL,
      LINKEDIN_SCOPES.R_ORGANIZATION_ADMINSTRATION,
      LINKEDIN_SCOPES.W_ORGANIZATION_SOCIAL,
    ];
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: this.scopes.join(' '),
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }
}
