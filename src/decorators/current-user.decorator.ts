import { createParamDecorator, ExecutionContext } from '@nestjs/common';
// Attempt to locate the correct User type.
// common sources are @clerk/backend, @clerk/clerk-sdk-node, or sometimes @clerk/express if it re-exports backend types.
// Based on clerkClient.users.getUser() in ClerkAuthGuard, @clerk/backend is a strong candidate.
import { User } from '@clerk/backend'; // Or User from '@clerk/clerk-sdk-node'

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | User[keyof User] | undefined => {
    const request = ctx.switchToHttp().getRequest();
    // request.user is populated by ClerkAuthGuard or a similar mechanism
    // Ensure that the guard indeed populates request.user with an object of type User from @clerk/backend
    const user: User | undefined = request.user; 

    if (!user) {
      // Depending on application design, might want to throw an error if user is expected
      // For now, returning undefined if no user is present on the request
      return undefined; 
    }

    if (data) {
      return user[data];
    }
    return user;
  },
);
