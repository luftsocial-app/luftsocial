import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Post,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Permission, UserRole } from '../../common/enums/roles';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  // @Roles(Role.Admin)
  async getUsers() {
    return this.usersService.getUsers();
  }

  @Get('Tenant')
  async getTenantUsers(@CurrentUser() user: any) {
    try {
      return await this.usersService.getTenantUsers(user.tenantId);
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
        user.tenantId,
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
      // currentUser should include the relevant properties (e.g. email, firstName, lastName, tenantId)
      return await this.usersService.syncClerkUser(
        clerkId,
        currentUser.tenantId,
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
  async findUser(@Param('clerkId') clerkId: string) {
    try {
      const user = await this.usersService.findUser(clerkId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
