import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateInvitationDto } from './helper/create-invitation.dto';

@Injectable()
export class OrganizationInvitationService {
  private readonly logger = new Logger(OrganizationInvitationService.name);
  private readonly clerkApiUrl = 'https://api.clerk.dev/v1';
  private readonly clerkSecretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.clerkSecretKey = this.configService.get('clerk.secretKey');
  }

  async createInvitation(
    organizationId: string,
    createInvitationDto: CreateInvitationDto,
    requestingUserId: string,
  ): Promise<any> {
    try {
      // Determine the inviter user ID (default to requesting user if not provided)
      const inviterUserId = requestingUserId;

      // Make API call to Clerk
      const response = await axios.post(
        `${this.clerkApiUrl}/organizations/${organizationId}/invitations`,
        {
          email_address: createInvitationDto.email_address,
          inviter_user_id: inviterUserId,
          role: createInvitationDto.role,
          public_metadata: createInvitationDto.public_metadata || null,
          private_metadata: createInvitationDto.private_metadata || null,
          redirect_url: createInvitationDto.redirect_url || null,
          expires_in_days: createInvitationDto.expires_in_days || null,
        },
        {
          headers: {
            Authorization: `Bearer ${this.clerkSecretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error creating organization invitation: ${error.message}`,
        error.stack,
      );

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // Handle specific error cases
        if (status === 401 || status === 403) {
          throw new UnauthorizedException(
            'Not authorized to create invitations',
          );
        } else if (status === 400) {
          throw new BadRequestException(
            data.errors?.[0]?.message || 'Invalid invitation request',
          );
        }
      }

      throw new InternalServerErrorException(
        'Failed to create organization invitation',
      );
    }
  }

  async listInvitations(organizationId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.clerkApiUrl}/organizations/${organizationId}/invitations`,
        {
          headers: {
            Authorization: `Bearer ${this.clerkSecretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error listing organization invitations: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to list organization invitations',
      );
    }
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.clerkApiUrl}/organizations/${organizationId}/invitations/${invitationId}/revoke`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.clerkSecretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error revoking organization invitation: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to revoke organization invitation',
      );
    }
  }
}
