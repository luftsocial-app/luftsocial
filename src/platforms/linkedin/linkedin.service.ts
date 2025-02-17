import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LinkedInRepository } from './repositories/linkedin.repository';
import {
  CommentResponse,
  PlatformService,
  PostResponse,
  SocialAccountDetails,
  TokenResponse,
} from '../platform-service.interface';
import { LinkedInApiException } from './helpers/linkedin-api.exception';
import {
  LinkedInOrganization,
  LinkedInTokenResponse,
} from './helpers/linkedin.interface';
import {
  AccountMetrics,
  DateRange,
  PostMetrics,
} from 'src/cross-platform/helpers/cross-platform.interface';

@Injectable()
export class LinkedInService implements PlatformService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly apiVersion: string = 'v2';
  private readonly baseUrl: string = 'https://api.linkedin.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly linkedInRepo: LinkedInRepository,
  ) {
    this.clientId = this.configService.get<string>('LINKEDIN_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'LINKEDIN_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.get<string>('LINKEDIN_REDIRECT_URI');
  }

  async authorize(userId: string): Promise<string> {
    const state = await this.linkedInRepo.createAuthState(userId);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
      scope:
        'w_member_social r_organization_social r_organization_administration w_organization_social',
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    state: string,
    userId: string,
  ): Promise<LinkedInTokenResponse> {
    try {
      const tokenResponse = await this.getAccessToken(code);

      const organizations = await this.getOrganizations(
        tokenResponse.access_token,
      );
      const profile = await this.getUserProfile(tokenResponse.access_token);

      // Store the connection
      await this.linkedInRepo.updateAccountTokens(userId, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      });

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: 'bearer',
        scope: tokenResponse.scope.split(' '),
        metadata: {
          profile,
          organizations,
        },
      };
    } catch (error) {
      throw new LinkedInApiException(
        'Failed to handle LinkedIn callback',
        error,
      );
    }
  }

  async refreshToken(accountId: string): Promise<TokenResponse> {
    const account = await this.linkedInRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: account.socialAccount.refreshToken,
          client_id: this.configService.get('LINKEDIN_CLIENT_ID'),
          client_secret: this.configService.get('LINKEDIN_CLIENT_SECRET'),
        }),
      );

      await this.linkedInRepo.updateAccountTokens(accountId, {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: 'bearer',
        scope: response.data.scope.split(' '),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to refresh LinkedIn token',
        HttpStatus.BAD_REQUEST,
        error,
      );
    }
  }

  async getUserAccounts(userId: string): Promise<SocialAccountDetails[]> {
    const account = await this.linkedInRepo.getById(userId);
    if (!account) {
      throw new NotFoundException('No Linkedin accounts found for user');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/organizationAcls`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          q: 'roleAssignee',
        },
      });

      const organizationIds = response.data.elements.map(
        (el) => el.organization,
      );
      const orgDetails = await Promise.all(
        organizationIds.map((orgId) =>
          axios.get(`${this.baseUrl}/organizations/${orgId}`, {
            headers: {
              Authorization: `Bearer ${account.socialAccount.accessToken}`,
            },
          }),
        ),
      );

      return orgDetails.map((org) => ({
        id: org.data.id,
        name: org.data.localizedName,
        type: 'organization',
        avatarUrl: org.data.logoV2?.original,
        platformSpecific: {
          vanityName: org.data.vanityName,
          locations: org.data.locations,
        },
      }));
    } catch (error) {
      throw new LinkedInApiException('Failed to fetch user accounts', error);
    }
  }

  async post(
    accountId: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<PostResponse> {
    try {
      const account = await this.linkedInRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const author = `urn:li:organization:${account.metadata.organizations[0].id}`;

      const postData: any = {
        author,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
      };

      // Handle media if provided
      if (mediaUrls?.length) {
        const mediaAssets = await Promise.all(
          mediaUrls.map((url) =>
            this.uploadMedia(account.socialAccount.accessToken, url),
          ),
        );

        postData.content = {
          media: {
            id: mediaAssets[0].asset,
            type: mediaAssets[0].type,
          },
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/rest/posts`,
        postData,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
        },
      );

      return {
        platformPostId: response.data.id,
        postedAt: new Date(),
      };
    } catch (error) {
      throw new LinkedInApiException('Failed to create LinkedIn post', error);
    }
  }

  async getComments(
    accountId: string,
    postId: string,
    pageToken?: string,
  ): Promise<CommentResponse> {
    try {
      const account = await this.linkedInRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const response = await axios.get(
        `${this.baseUrl}/rest/socialActions/${postId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
          params: {
            start: pageToken || 0,
            count: 20,
          },
        },
      );

      return {
        items: response.data.elements.map((comment) => ({
          id: comment.id,
          content: comment.message.text,
          authorId: comment.actor,
          authorName: comment.actor.name,
          createdAt: new Date(comment.created.time),
        })),
        nextPageToken: response.data.paging?.start?.toString(),
      };
    } catch (error) {
      throw new LinkedInApiException(
        'Failed to fetch LinkedIn comments',
        error,
      );
    }
  }

  async getPostMetrics(
    accountId: string,
    postId: string,
  ): Promise<PostMetrics> {
    try {
      const account = await this.linkedInRepo.getById(accountId);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.NOT_FOUND);
      }

      const response = await axios.get(
        `${this.baseUrl}/rest/organizationalEntityShareStatistics`,
        {
          headers: {
            Authorization: `Bearer ${account.socialAccount.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': this.apiVersion,
          },
          params: {
            q: 'organizationalEntity',
            organizationalEntity: postId,
          },
        },
      );

      const stats = response.data.totalShareStatistics;

      return {
        engagement: stats.engagement || 0,
        impressions: stats.impressionCount || 0,
        reach: stats.uniqueImpressionsCount || 0,
        reactions: stats.likeCount || 0,
        comments: stats.commentCount || 0,
        shares: stats.shareCount || 0,
        platformSpecific: {
          clicks: stats.clickCount || 0,
          engagement_detail: {
            likes: stats.likeCount || 0,
            comments: stats.commentCount || 0,
            shares: stats.shareCount || 0,
            clicks: stats.clickCount || 0,
          },
        },
      };
    } catch (error) {
      throw new LinkedInApiException('Failed to fetch LinkedIn metrics', error);
    }
  }

  async getAccountMetrics(
    accountId: string,
    dateRange: DateRange,
  ): Promise<AccountMetrics> {
    const account = await this.linkedInRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');
    if (!account.organizations || account.organizations.length === 0) {
      throw new LinkedInApiException('No organizations found for account');
    }

    try {
      // Fetch metrics for all organizations and aggregate them
      const metrics = await Promise.all(
        account.organizations.map(async (orgId) => {
          const response = await axios.get(
            `${this.baseUrl}/organizationalEntityShareStatistics`,
            {
              params: {
                q: 'organizationalEntity',
                organizationalEntity: orgId,
                timeIntervals: {
                  start: dateRange.startDate,
                  end: dateRange.endDate,
                },
              },
              headers: {
                Authorization: `Bearer ${account.socialAccount.accessToken}`,
              },
            },
          );

          return {
            followers: response.data.followerCount || 0,
            engagement: response.data.engagement || 0,
            impressions: response.data.impressionCount || 0,
            reach: response.data.uniqueImpressionsCount || 0,
            posts: response.data.shareCount || 0,
            platformSpecific: {
              organizationId: orgId,
              clickCount: response.data.clickCount,
              likeCount: response.data.likeCount,
              commentCount: response.data.commentCount,
              shareCount: response.data.shareCount,
            },
          };
        }),
      );

      // Aggregate metrics from all organizations
      const aggregatedMetrics = metrics.reduce(
        (acc, curr) => ({
          followers: acc.followers + curr.followers,
          engagement: acc.engagement + curr.engagement,
          impressions: acc.impressions + curr.impressions,
          reach: acc.reach + curr.reach,
          posts: acc.posts + curr.posts,
          platformSpecific: {
            organizations: [
              ...(acc.platformSpecific?.organizations || []),
              curr.platformSpecific,
            ],
          },
        }),
        {
          followers: 0,
          engagement: 0,
          impressions: 0,
          reach: 0,
          posts: 0,
          platformSpecific: { organizations: [] },
        },
      );

      return {
        ...aggregatedMetrics,
        dateRange,
      };
    } catch (error) {
      throw new LinkedInApiException('Failed to fetch account metrics', error);
    }
  }
  private async getAccessToken(code: string): Promise<any> {
    const response = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        },
      },
    );
    return response.data;
  }

  private async getUserProfile(accessToken: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/v2/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }

  private async getOrganizations(accessToken: string): Promise<any[]> {
    const response = await axios.get(
      `${this.baseUrl}/v2/organizationAcls?q=roleAssignee`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data.elements;
  }

  private async uploadMedia(
    accessToken: string,
    mediaUrl: string,
  ): Promise<any> {
    // First, initiate upload
    const registerUpload = await axios.post(
      `${this.baseUrl}/rest/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: 'urn:li:organization:123', // Replace with actual org ID
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    // Download media
    const mediaResponse = await axios.get(mediaUrl, { responseType: 'stream' });

    // Upload to LinkedIn
    await axios.put(
      registerUpload.data.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl,
      mediaResponse.data,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mediaResponse.headers['content-type'],
        },
      },
    );

    return {
      asset: registerUpload.data.value.asset,
      type: 'IMAGE',
    };
  }

  async getUserOrganizations(
    accountId: string,
  ): Promise<LinkedInOrganization[]> {
    const account = await this.linkedInRepo.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    try {
      const response = await axios.get(`${this.baseUrl}/organizations`, {
        headers: {
          Authorization: `Bearer ${account.socialAccount.accessToken}`,
        },
        params: {
          q: 'admin',
          fields: 'id,name,vanityName,localizedName,localizedDescription',
        },
      });

      const organizations = await Promise.all(
        response.data.elements.map(async (org: any) => {
          return this.linkedInRepo.upsertOrganization({
            account: account,
            organizationId: org.id,
            name: org.localizedName || org.name,
            vanityName: org.vanityName,
            description: org.localizedDescription,
          });
        }),
      );

      return organizations;
    } catch (error) {
      throw new HttpException(
        'Failed to fetch LinkedIn organizations',
        HttpStatus.BAD_REQUEST,
        error,
      );
    }
  }
}
