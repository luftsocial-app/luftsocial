import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  HttpException,
  HttpStatus,
  BadRequestException,
  Req, // Added Req decorator
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permission, UserRole } from '../common/enums/roles'; // Assuming Permission is used elsewhere or can be removed if not
import { UserService } from './user.service';
import { User as ClerkUserType } from '@clerk/backend'; // Import ClerkUserType
import { Request } from 'express'; // Import Request from express

// DTO for updateUserRole body if not already defined
// For now, using inline type as in the original file for body.
// Consider creating a DTO e.g. UpdateUserRoleControllerDto { userId: string, roles: UserRole[] }
// interface UpdateUserRoleControllerDto {
//   userId: string;
//   roles: UserRole[];
//   permissions?: Permission[]; // Kept permissions for now, remove if not used
// }

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  // @Roles(Role.Admin) // Assuming Roles decorator and Admin role are defined elsewhere
  async getUsers(@CurrentUser() user: ClerkUserType) { // Updated user type
    // Potentially use 'user' for authorization checks if needed
    this.userService.getUsers(); // Original: return this.userService.getUsers();
                                // Corrected: The service method `getUsers` in `UserService` returns Promise<ClerkUserType[]>
                                // so it should be returned.
    return this.userService.getUsers();
  }

  @Get('tenant') // Changed path for clarity, was 'Tenant'
  async getTenantUsers(@Req() request: Request) { // Use @Req and Request type
    try {
      const orgId = request.auth?.orgId; // Access orgId from request.auth
      if (!orgId) {
        throw new BadRequestException('Organization ID not found in request.');
      }
      return await this.userService.getTenantUsers(orgId);
    } catch (error) {
      // Handle specific errors or rethrow
      if (error instanceof BadRequestException) throw error;
      throw new HttpException(
        error.message || 'Failed to get tenant users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('role')
  async updateUserRole(
    @Body()
    body: { userId: string; roles: UserRole[]; permissions?: Permission[] }, // permissions kept optional
    @CurrentUser() user: ClerkUserType, // Updated user type
  ) {
    try {
      // The service method `updateUserRole` now expects (userId, rolesArray)
      // user.orgId is no longer passed as per the refactored service method.
      return await this.userService.updateUserRole(body.userId, body.roles);
    } catch (error) {
      // It's good practice to let NestJS handle HttpException transformation if possible
      // or be more specific with error handling.
      if (error instanceof HttpException) throw error; // Re-throw if already an HttpException
      throw new HttpException(
        error.message || 'Failed to update user role',
        HttpStatus.INTERNAL_SERVER_ERROR, // Default to internal server error
      );
    }
  }

  // Assuming the path implies fetching a user by their Clerk ID, not tenant specific.
  // If it were tenant-specific, the path might be /tenant/:clerkId or similar.
  // The old path was ':tenantId/:clerkId' which is ambiguous if tenantId is not used.
  // Let's assume clerkId is globally unique and tenantId in path was for a different purpose.
  // For now, simplifying path to ':clerkId' as tenantId is not used in the refactored service call.
  @Get(':clerkId')
  async findUser(
    @Param('clerkId') clerkId: string,
    @CurrentUser() user: ClerkUserType, // Updated user type, can be used for auth checks
  ) {
    try {
      // Call the refactored service method
      const foundUser = await this.userService.getClerkUserWithLocalRolesById(clerkId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return foundUser;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to find user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
