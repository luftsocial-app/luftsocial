import { Injectable, NestMiddleware } from '@nestjs/common';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class WebSocketAuthMiddleware implements NestMiddleware {
  use(client: Socket, next: (err?: any) => void) {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication token is missing'));
    }

    try {
      const user = jwt.verify(token, process.env.CLERK_JWT_SECRET);
      client.data.user = user; // Attach the user object to client.data
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  }
}