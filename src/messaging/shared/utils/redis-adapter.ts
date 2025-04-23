import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import * as config from 'config';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: config.get('chat.redis.customAdapterURL'),
    });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// Make the WebSocket event name dynamically (Using user id with the event name like that)

// For this, You have to make your WebSocket URL privately (You need to handle the private route with JWT authentication here the token is created by the user ID, email, and so on). So whenever the user connects to that web socket, you have to decode the JWT token and get the current user ID from that token (This is how we can identify who belongs to that message)
