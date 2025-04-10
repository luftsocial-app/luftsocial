import { ConfigService } from '@nestjs/config';
import { SocketWithUser } from '../interfaces/socket.interfaces';
import { MessageEventType } from '../events/message-events';

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

  handleError(client: SocketWithUser, errorEvent: ErrorEvent): void {
    client.emit(MessageEventType.ERROR, errorEvent);
  }

  private typingThrottle(): number {
    return this.configService.get<number>(
      'messaging.throttle.typingRateMs',
      2000,
    );
  }
}
