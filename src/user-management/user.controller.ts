import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permission, UserRole } from '../common/enums/roles';
import { UserService } from './user.service';
import { AuthObject } from '@clerk/express';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  // @Roles(Role.Admin)
  async getUsers() {
    return this.userService.getUsers();
  }

  @Get('Tenant')
  async getTenantUsers(@CurrentUser() user: AuthObject) {
    try {
      return await this.userService.getTenantUsers(user.orgId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('role')
  async updateUserRole(
    @Body()
    body: { userId: string; roles: UserRole[]; permissions: Permission[] },
    @CurrentUser() user: AuthObject,
  ) {
    try {
      return await this.userService.updateUserRole(
        body.userId,
        body.roles,
        user.orgId,
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        error instanceof BadRequestException
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':tenantId/:clerkId')
  async findUser(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('clerkId') clerkId: string,
    @CurrentUser() authUser: AuthObject,
  ) {
    // Authorization: Check if the authenticated user can access the requested tenant's data.
    // This typically means checking if authUser.claims.org_id matches the tenantId,
    // or if the user has a super_admin role or similar.
    // For now, a basic check: if the authUser's org_id claim doesn't match the requested tenantId, deny access.
    // A more sophisticated RBAC might be needed for more complex scenarios (e.g. super admins).
    if (authUser.claims?.org_id !== tenantId) {
      // TODO: Implement more sophisticated role-based access if needed.
      // For now, only users belonging to the tenant can fetch user details from that tenant.
      // Consider if a user from tenant A should be able to see user details from tenant B, even if they know the IDs.
      // Typically, this should be forbidden unless the authUser is a system-level admin.
      throw new HttpException('Forbidden: You do not have access to this tenant.', HttpStatus.FORBIDDEN);
    }

    try {
      // Call the modified service method, now passing both clerkId and tenantId for explicit scoping.
      const user = await this.userService.findById(clerkId, tenantId);
      if (!user) {
        // If findById returns null (either user not found by clerkId, or not in the specified tenant),
        // return a 404.
        throw new HttpException('User not found in this tenant', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      // Catching potential errors from the service layer or the HttpException thrown above.
      if (error instanceof HttpException) {
        throw error; // Re-throw if it's already an HttpException
      }
      // Generic error handling for unexpected issues.
      throw new HttpException(error.message || 'An internal server error occurred', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
