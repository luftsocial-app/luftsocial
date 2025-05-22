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
import { AuthObject, User as clerkUser } from '@clerk/express'; // Use User from @clerk/express as per other files, or @clerk/backend if that's the exact type from service

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  // @Roles(Role.Admin)
  async getUsers() {
    return this.userService.getUsers();
  }

  @Get('tenant') // Changed path for clarity, was 'Tenant'
  async getTenantUsers(@Req() request: Request) {
    // Use @Req and Request type
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
        error.message,
        error instanceof BadRequestException
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':tenantId/:clerkId')
  async findUser(@Param('clerkId') clerkId: string): Promise<clerkUser> {
    // Adjusted return type
    try {
      // The userService.findById now returns a clerkUser directly
      // and handles its own not-found logic by potentially throwing an error that we catch here.
      const user: clerkUser = await this.userService.findById(clerkId);
      return user;
    } catch (error) {
      // Check if the error from userService.findById (or Clerk client) indicates a "not found" status
      // This condition matches what was used in UserService for Clerk errors.
      if (
        error.status === 404 ||
        (error.errors && error.errors[0]?.code === 'resource_not_found')
      ) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // For other types of errors, throw a generic internal server error
      // It's good practice to log the original error for debugging purposes if a logger is available
      // this.logger.error(`Error in findUser for clerkId ${clerkId}:`, error); // Example if logger was injected
      throw new HttpException(
        error.message || 'An error occurred while fetching the user.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
