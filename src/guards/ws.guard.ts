import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

@Injectable()
export class WsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = verify(token, process.env.JWT_SECRET);
      client.data.user = payload;

      return true;
    } catch (err) {
      console.log(err);
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth =
      client.handshake.auth?.token || client.handshake.headers?.authorization;

    if (!auth) {
      return undefined;
    }

    return auth.replace('Bearer ', '');
  }
}
