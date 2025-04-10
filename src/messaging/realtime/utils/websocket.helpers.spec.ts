import { ConfigService } from '@nestjs/config';
import { WebsocketHelpers } from './websocket.helpers';
import { MessageEventType } from '../events/message-events';
import { SocketWithUser } from '../interfaces/socket.interfaces';

describe('WebsocketHelpers', () => {
  let websocketHelpers: WebsocketHelpers;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(2000),
    } as any;
    websocketHelpers = new WebsocketHelpers(configService);
  });

  describe('isThrottled', () => {
    it('should return true when called within throttle time', () => {
      const key = 'test-key';
      expect(websocketHelpers.isThrottled(key)).toBeFalsy();
      expect(websocketHelpers.isThrottled(key)).toBeTruthy();
    });

    it('should return false after throttle time passes', async () => {
      const key = 'test-key';
      expect(websocketHelpers.isThrottled(key)).toBeFalsy();

      await new Promise((resolve) => setTimeout(resolve, 2100));
      expect(websocketHelpers.isThrottled(key)).toBeFalsy();
    });
  });

  describe('config getters', () => {
    it('should get typingThrottle config', () => {
      websocketHelpers.isThrottled('test');
      expect(configService.get).toHaveBeenCalledWith(
        'messaging.throttle.typingRateMs',
        2000,
      );
    });

    it('should get readReceiptThrottle config', () => {
      websocketHelpers.readReceiptThrottle();
      expect(configService.get).toHaveBeenCalledWith(
        'messaging.throttle.readReceiptRateMs',
        2000,
      );
    });

    it('should get messageThrottle config', () => {
      websocketHelpers.messageThrottle();
      expect(configService.get).toHaveBeenCalledWith(
        'messaging.throttle.messageRateMs',
        2000,
      );
    });

    it('should get maxClientsPerUser config', () => {
      websocketHelpers.maxClientsPerUser();
      expect(configService.get).toHaveBeenCalledWith(
        'messaging.maxClientsPerUser',
        5,
      );
    });
  });

  describe('handleError', () => {
    it('should emit error event to client', () => {
      const mockClient = {
        emit: jest.fn(),
      } as any as SocketWithUser;

      const errorEvent = new Error('test') as unknown as ErrorEvent;

      websocketHelpers.handleError(mockClient, errorEvent);
      expect(mockClient.emit).toHaveBeenCalledWith(
        MessageEventType.ERROR,
        errorEvent,
      );
    });
  });
});
