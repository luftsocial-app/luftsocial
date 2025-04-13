import { ConfigService } from '@nestjs/config';
import { SocketWithUser } from '../interfaces/socket.interfaces';
import { MessageEventType } from '../events/message-events';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebsocketHelpers {
  private readonly throttleTimers = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  isThrottled(key: string): boolean {
    const now = Date.now();
    const lastTime = this.throttleTimers.get(key) || 0;

    if (now - lastTime < this.typingThrottle()) {
      return true;
    }

    this.throttleTimers.set(key, now);
    return false;
  }

  private typingThrottle(): number {
    return this.configService.get<number>(
      'messaging.throttle.typingRateMs',
      2000,
    );
  }

  readReceiptThrottle(): number {
    return this.configService.get<number>(
      'messaging.throttle.readReceiptRateMs',
      2000,
    );
  }
  messageThrottle(): number {
    return this.configService.get<number>(
      'messaging.throttle.messageRateMs',
      2000,
    );
  }
  maxClientsPerUser(): number {
    return this.configService.get<number>('messaging.maxClientsPerUser', 5);
  }

  handleError(client: SocketWithUser, errorEvent: ErrorEvent): void {
    client.emit(MessageEventType.ERROR, errorEvent);
  }
}
