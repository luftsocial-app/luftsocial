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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  // @Roles(Role.Admin)
  async getUsers() {
    return this.userService.getUsers();
  }

  @Get('Tenant')
  async getTenantUsers(@CurrentUser() user: any) {
    try {
      return await this.userService.getTenantUsers(user.tenantId);
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
      return await this.userService.updateUserRole(
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

  @Get(':tenantId/:clerkId')
  async findUser(@Param('clerkId') clerkId: string) {
    try {
      const user = await this.userService.findById(clerkId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
