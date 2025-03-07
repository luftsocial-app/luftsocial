import { Socket } from 'socket.io';

/**
 * Extended Socket interface with user data
 */
export interface SocketWithUser extends Socket {
  data: {
    user: {
      id: string;
      username: string;
      tenantId: string;
      [key: string]: any;
    };
    deviceId?: string;
  };
}

/**
 * Standard success response format
 */
export interface SuccessResponse {
  success: true;
  [key: string]: any;
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Union type for all socket responses
 */
export type SocketResponse = SuccessResponse | ErrorResponse;

/**
 * Error codes used in socket responses
 */
export enum SocketErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ACCESS_DENIED = 'ACCESS_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  FORBIDDEN = 'FORBIDDEN',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_OPERATION = 'INVALID_OPERATION',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
