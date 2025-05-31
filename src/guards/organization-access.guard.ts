import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(OrganizationAccessGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.auth;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get the organization ID from the request
    const organizationId = this.extractOrganizationId(request);

    if (!organizationId) {
      // If no specific organization ID is required, just check if the user has any organization
      if (!user.sessionClaims?.org_id) {
        this.logger.warn('User is not a member of any organization');
        return false;
      }
      return true;
    }

    // Check if the user belongs to the specified organization
    const userOrgId = user.sessionClaims?.org_id;

    if (userOrgId !== organizationId) {
      this.logger.warn(
        `User belongs to organization ${userOrgId}, but tried to access resources for organization ${organizationId}`,
      );
      return false;
    }

    // Store the organization ID in the request for use in controllers
    request.organizationId = organizationId;

    return true;
  }

  private extractOrganizationId(request: any): string | undefined {
    // First check the path parameters
    const orgIdParam = request.params.organizationId;
    if (orgIdParam) {
      return orgIdParam;
    }

    // Then check the query parameters
    const orgIdQuery = request.query.organizationId as string;
    if (orgIdQuery) {
      return orgIdQuery;
    }

    // Then check for tenantId in query parameters (for backward compatibility)
    const tenantIdQuery = request.query.tenantId as string;
    if (tenantIdQuery) {
      return tenantIdQuery;
    }

    // Finally check the request body
    const orgIdBody = request.body?.organizationId;
    if (orgIdBody) {
      return orgIdBody;
    }

    const tenantIdBody = request.body?.tenantId;
    if (tenantIdBody) {
      return tenantIdBody;
    }

    // If no organization ID is specified, use the user's current organization
    return request.auth?.sessionClaims?.org_id;
  }
}
