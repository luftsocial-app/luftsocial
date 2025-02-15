import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClerkUser } from '../interfaces/clerk-user.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof ClerkUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.auth?.userId;

    if (!user) {
      return null;
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
