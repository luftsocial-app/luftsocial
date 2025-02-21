import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
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
