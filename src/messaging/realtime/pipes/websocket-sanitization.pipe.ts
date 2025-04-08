import { Injectable, PipeTransform } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ContentSanitizer } from '../../shared/utils/content-sanitizer';

@Injectable()
export class WebsocketSanitizationPipe implements PipeTransform {
  constructor(private readonly contentSanitizer: ContentSanitizer) {}

  transform(payload: any) {
    const { isValid, sanitized } =
      this.contentSanitizer.sanitizeRealtimeMessage(payload);

    if (!isValid) {
      throw new WsException('Invalid message content');
    }

    return sanitized;
  }
}
