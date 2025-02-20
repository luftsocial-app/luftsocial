import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LINKEDIN_SCOPES } from 'src/enum/scopes.enum';

@Injectable()
export class LinkedInConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: string[];
  readonly apiVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'LINKEDIN_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.get<string>('LINKEDIN_REDIRECT_URI');
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
