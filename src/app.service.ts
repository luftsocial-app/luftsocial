import { Injectable } from '@nestjs/common';
import { clerkClient, User } from '@clerk/express';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async getUsers(): Promise<User[]> {
    const users = await clerkClient.users.getUserList();
    console.log({ users: users.data });

    return users.data;
  }
}
