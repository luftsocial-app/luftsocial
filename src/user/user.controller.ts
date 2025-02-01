import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerBehindProxyGuard } from '../guards/throttler-behind-proxy.guard';
import { NewUser } from './helpers/new-user';
import { UpdateUser } from './helpers/update-user';
import { UserService } from './user.service';
import { RoleGuard } from '../guards/role-guard';
@Controller({
  path: 'users',
  version: '1',
})
@UseGuards(ThrottlerBehindProxyGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  // @Roles({ roles: ['admin'] })
  async createUser(@Body() newUser: NewUser): Promise<any> {
    return await this.userService.createUser(newUser);
  }

  @Put('/:id')
  async updateUser(
    @Body() updateUser1: UpdateUser,
    @Param('id') userId: string,
    @Request() req: any,
  ): Promise<void> {
    if (userId !== req.user.sub) {
      console.log({ user: req.user });
      throw new ForbiddenException('You can only update your own account');
    }
    await this.userService.updateUser(userId, updateUser1);
  }

  @Get('/token')
  async getToken(): Promise<string> {
    console.log('token endpoint called');
    return 'hello';
    // return await this.keycloakService.loginClient();
  }

  @Get(':id')
  // @Scopes('get-user')
  async getUser(
    @Param('id') userId: string,
    @Request() req: any,
    user: any,
  ): Promise<any> {
    console.log({ req: req.user, user });
    return await this.userService.getUser(userId);
  }

  @UseGuards(RoleGuard)
  @Put(':id/change-password')
  async changePassword(
    @Body() userRepresentation: any,
    @Param('id') userId: string,
    @Request() req: any,
  ): Promise<void> {
    // const isAdmin = req.user.realm_access.roles.includes('admin');
    // if (userId !== req.user.sub && !isAdmin) {
    //   console.log({ user: req.user.realm_access });
    //   throw new ForbiddenException('You can only update your own account');
    // }
    await this.userService.adminChangePassword(userId);
  }

  @Put(':username/forgot-password')
  async forgotPassword(@Param('username') username: string): Promise<void> {
    await this.userService.resetPassword(username);
  }

  @Delete(':id')
  async deleteUser(@Param('id') userId: string): Promise<void> {
    await this.userService.deleteUser(userId);
  }
}
