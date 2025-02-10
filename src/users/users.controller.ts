import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Post,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserRole, Permission } from '../types/enums';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';

@Controller('users')
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('organization')
  async getOrganizationUsers(@CurrentUser() user: any) {
    try {
      return await this.usersService.getOrganizationUsers(user.organizationId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('role')
  async updateUserRole(
    @Body()
    body: { userId: string; roles: UserRole[]; permissions: Permission[] },
    @CurrentUser() user: any,
  ) {
    try {
      return await this.usersService.updateUserRole(
        body.userId,
        body.roles,
        user.organizationId,
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

  @Post('sync/:clerkId')
  async syncUser(
    @Param('clerkId') clerkId: string,
    @CurrentUser() currentUser: any,
  ) {
    try {
      if (!clerkId) {
        throw new BadRequestException('ClerkId is required');
      }
      // currentUser should include the relevant properties (e.g. email, firstName, lastName, organizationId)
      return await this.usersService.syncClerkUser(
        clerkId,
        currentUser.organizationId,
        currentUser,
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
    @Param('clerkId') clerkId: string,
    @Param('tenantId') tenantId: string,
  ) {
    try {
      const user = await this.usersService.findUser(clerkId, tenantId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
