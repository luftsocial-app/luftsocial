import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FACEBOOK_SCOPES, INSTAGRAM_SCOPES } from 'src/enum/scopes.enum';

@Injectable()
export class InstagramConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly scopes: string[];
  readonly apiVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('INSTAGRAM_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'INSTAGRAM_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.get<string>('INSTAGRAM_REDIRECT_URI');
    this.apiVersion = 'v18.0';
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
