export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scope: string[];
  authHost: string;
  tokenPath: string;
  authorizePath: string;
  profilePath?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  platform: string;
  raw?: any;
}
