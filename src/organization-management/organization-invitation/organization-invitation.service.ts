import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { clerkClient } from '@clerk/express';
import { CreateInvitationDto } from './helper/create-invitation.dto';

@Injectable()
export class OrganizationInvitationService {
  private readonly logger = new Logger(OrganizationInvitationService.name);

  constructor(private readonly configService: ConfigService) {
    // Initialize Clerk client if needed (usually done globally in main.ts)
    // The secret key is typically configured when initializing clerkClient
  }

  async createInvitation(
    organizationId: string,
    createInvitationDto: CreateInvitationDto,
    requestingUserId: string,
  ): Promise<any> {
    try {
      const inviterUserId = requestingUserId;

      const invitation =
        await clerkClient.organizations.createOrganizationInvitation({
          organizationId,
          emailAddress: createInvitationDto.email_address,
          inviterUserId: inviterUserId,
          role: createInvitationDto.role,
          publicMetadata: createInvitationDto.public_metadata || {},
          redirectUrl: createInvitationDto.redirect_url,
        });

      this.logger.log(
        `Successfully created invitation for ${createInvitationDto.email_address}`,
      );
      return invitation;
    } catch (error) {
      this.logger.error(
        `Error creating organization invitation: ${error.message}`,
        error.stack,
      );

      if (error.errors) {
        const clerkError = error.errors[0];
        if (clerkError.code === 'authentication_invalid') {
          throw new UnauthorizedException('Invalid authentication credentials');
        } else if (clerkError.code === 'authorization_invalid') {
          throw new UnauthorizedException(
            'Not authorized to create invitations',
          );
        } else if (clerkError.code === 'form_invalid') {
          throw new BadRequestException(
            clerkError.message || 'Invalid invitation data',
          );
        }
      }

      if (
        error.message?.includes('unauthorized') ||
        error.message?.includes('forbidden')
      ) {
        throw new UnauthorizedException('Not authorized to create invitations');
      } else if (
        error.message?.includes('invalid') ||
        error.message?.includes('bad request')
      ) {
        throw new BadRequestException('Invalid invitation request');
      }

      throw new InternalServerErrorException(
        'Failed to create organization invitation',
      );
    }
  }

  async listInvitations(organizationId: string): Promise<any> {
    try {
      const invitations =
        await clerkClient.organizations.getOrganizationInvitationList({
          organizationId,
          limit: 20,
          offset: 0,
        });

      this.logger.log(
        `Retrieved ${invitations.data.length} invitations for organization ${organizationId}`,
      );
      return invitations;
    } catch (error) {
      this.logger.error(
        `Error listing organization invitations: ${error.message}`,
        error.stack,
      );

      // Handle Clerk-specific errors
      if (error.errors) {
        const clerkError = error.errors[0];
        if (clerkError.code === 'resource_not_found') {
          throw new BadRequestException('Organization not found');
        } else if (clerkError.code === 'authorization_invalid') {
          throw new UnauthorizedException('Not authorized to list invitations');
        }
      }

      throw new InternalServerErrorException(
        'Failed to list organization invitations',
      );
    }
  }

  async getInvitation(
    organizationId: string,
    invitationId: string,
  ): Promise<any> {
    try {
      const invitation =
        await clerkClient.organizations.getOrganizationInvitation({
          organizationId,
          invitationId,
        });

      return invitation;
    } catch (error) {
      this.logger.error(
        `Error getting organization invitation: ${error.message}`,
        error.stack,
      );

      if (error.errors?.[0]?.code === 'resource_not_found') {
        throw new BadRequestException('Invitation not found');
      }

      throw new InternalServerErrorException(
        'Failed to get organization invitation',
      );
    }
  }

  /**
   * Accept an organization invitation
   * This method handles the server-side acceptance of an invitation
   */
  async acceptInvitation(
    organizationId: string,
    invitationId: string,
    userId?: string,
  ): Promise<any> {
    try {
      const membership =
        await clerkClient.organizations.createOrganizationMembership({
          organizationId,
          userId: userId, // The user who is accepting the invitation
          role: 'member', // Default role, this might be determined by the invitation
        });

      // After creating membership, delete the invitation
      await this.revokeInvitation(organizationId, invitationId);

      this.logger.log(
        `Successfully accepted invitation ${invitationId} for user ${userId}`,
      );
      return {
        membership,
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error accepting organization invitation: ${error.message}`,
        error.stack,
      );

      if (error.errors) {
        const clerkError = error.errors[0];
        if (clerkError.code === 'resource_not_found') {
          throw new BadRequestException('Invitation not found or already used');
        } else if (clerkError.code === 'authorization_invalid') {
          throw new UnauthorizedException(
            'Not authorized to accept this invitation',
          );
        } else if (clerkError.code === 'form_invalid') {
          throw new BadRequestException('Invalid invitation data');
        }
      }

      throw new InternalServerErrorException(
        'Failed to accept organization invitation',
      );
    }
  }

  /**
   * Get invitation details for preview before acceptance
   * This is useful for showing invitation details to the user before they accept
   */
  async getInvitationDetails(
    organizationId: string,
    invitationId: string,
  ): Promise<any> {
    try {
      const invitation =
        await clerkClient.organizations.getOrganizationInvitation({
          organizationId,
          invitationId,
        });

      // Get organization details
      const organization = await clerkClient.organizations.getOrganization({
        organizationId,
      });

      return {
        invitation: {
          id: invitation.id,
          emailAddress: invitation.emailAddress,
          role: invitation.role,
          status: invitation.status,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          imageUrl: organization.imageUrl,
          membersCount: organization.membersCount,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting invitation details: ${error.message}`,
        error.stack,
      );

      if (error.errors?.[0]?.code === 'resource_not_found') {
        throw new BadRequestException('Invitation not found');
      }

      throw new InternalServerErrorException(
        'Failed to get invitation details',
      );
    }
  }

  /**
   * Check if user can accept invitation (validation)
   */
  async validateInvitationAcceptance(
    organizationId: string,
    invitationId: string,
    userId: string,
  ): Promise<{ canAccept: boolean; reason?: string }> {
    try {
      // Check if invitation exists and is still valid
      const invitation = await this.getInvitationDetails(
        organizationId,
        invitationId,
      );

      if (invitation.invitation.status !== 'pending') {
        return {
          canAccept: false,
          reason: 'Invitation is no longer pending',
        };
      }

      // Check if user is already a member
      try {
        const membershipList =
          await clerkClient.organizations.getOrganizationMembershipList({
            organizationId,
          });

        // Filter the membership list to check if the user is already a member
        const existingMembership = membershipList.data.find(
          (membership) => membership.publicUserData.userId === userId,
        );

        if (existingMembership) {
          return {
            canAccept: false,
            reason: 'User is already a member of this organization',
          };
        }
      } catch (error) {
        this.logger.warn(
          `Could not retrieve membership list: ${error.message}`,
        );
      }

      const user = await clerkClient.users.getUser(userId);
      const userEmail = user.emailAddresses.find(
        (email) => email.emailAddress === invitation.invitation.emailAddress,
      );

      if (!userEmail) {
        return {
          canAccept: false,
          reason: 'Invitation email does not match user email',
        };
      }

      return { canAccept: true };
    } catch (error) {
      this.logger.error(
        `Error validating invitation acceptance: ${error.message}`,
      );
      return {
        canAccept: false,
        reason: 'Unable to validate invitation',
      };
    }
  }

  // Bulk operations
  async createBulkInvitations(
    organizationId: string,
    invitations: CreateInvitationDto[],
    requestingUserId: string,
  ): Promise<any[]> {
    const results = [];

    for (const invitation of invitations) {
      try {
        const result = await this.createInvitation(
          organizationId,
          invitation,
          requestingUserId,
        );
        results.push({
          success: true,
          data: result,
          email: invitation.email_address,
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          email: invitation.email_address,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    this.logger.log(
      `Bulk invitation results: ${successCount} successful, ${failCount} failed`,
    );

    return results;
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
  ): Promise<any> {
    try {
      const revokedInvitation =
        await clerkClient.organizations.revokeOrganizationInvitation({
          organizationId,
          invitationId,
        });

      this.logger.log(`Successfully revoked invitation ${invitationId}`);
      return revokedInvitation;
    } catch (error) {
      this.logger.error(
        `Error revoking organization invitation: ${error.message}`,
        error.stack,
      );

      // Handle Clerk-specific errors
      if (error.errors) {
        const clerkError = error.errors[0];
        if (clerkError.code === 'resource_not_found') {
          throw new BadRequestException('Invitation not found');
        } else if (clerkError.code === 'authorization_invalid') {
          throw new UnauthorizedException(
            'Not authorized to revoke invitations',
          );
        }
      }

      throw new InternalServerErrorException(
        'Failed to revoke organization invitation',
      );
    }
  }
}
