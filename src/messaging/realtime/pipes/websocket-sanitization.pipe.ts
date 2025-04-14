import { Injectable, PipeTransform } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';

@Injectable()
export class WebsocketSanitizationPipe implements PipeTransform {
  constructor(private readonly contentSanitizer: ContentSanitizer) {}

  transform(payload: any) {
    const parsedPayload =
      typeof payload === 'string' ? JSON.parse(payload) : payload;
    const { isValid, sanitized } =
      this.contentSanitizer.sanitizeRealtimeMessage(parsedPayload);

    if (!isValid) {
      throw new WsException('Invalid message content');
    }

    return sanitized;
  }
}
