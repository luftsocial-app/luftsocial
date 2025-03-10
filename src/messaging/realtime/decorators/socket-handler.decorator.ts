import { Logger } from '@nestjs/common';
import { ErrorResponse } from '../interfaces/socket.interfaces';

/**
 * Helper function to create standardized error responses
 */
export function createErrorResponse(
  code: string,
  message: string,
): ErrorResponse {
  return {
    success: false,
    error: { code, message },
  };
}

/**
 * Decorator factory that wraps socket message handlers with standardized error handling
 *
 * This decorator captures exceptions from socket handlers and transforms them into
 * standardized error responses, eliminating repetitive try/catch blocks across the codebase.
 *
 * @example
 * ```
 * @SubscribeMessage('eventName')
 * @SocketHandler()
 * async handleEvent(client: SocketWithUser, payload: any): Promise<SocketResponse> {
 *   // Your code here - no need for try/catch blocks
 * }
 * ```
 */
export function SocketHandler() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`SocketHandler:${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      try {
        // Execute the original handler method
        return await originalMethod.apply(this, args);
      } catch (error) {
        // Log the error
        logger.error(`Error in ${propertyKey}: ${error.message}`, error.stack);

        // Handle specific error types based on the error message
        if (
          error.message?.includes('not found') ||
          error.message?.includes('Not found')
        ) {
          return createErrorResponse('NOT_FOUND', 'Resource not found');
        }

        if (error.message?.includes('direct chat')) {
          return createErrorResponse(
            'INVALID_OPERATION',
            'Cannot modify direct chat participants',
          );
        }

        if (error.message?.includes('Only admins')) {
          return createErrorResponse(
            'FORBIDDEN',
            'Only admins can perform this action',
          );
        }

        if (error.message?.includes('Cannot remove the conversation owner')) {
          return createErrorResponse(
            'FORBIDDEN',
            'Cannot remove the conversation owner',
          );
        }

        if (error.message?.includes('access')) {
          return createErrorResponse(
            'ACCESS_DENIED',
            'You do not have access to this resource',
          );
        }

        if (error.message?.includes('validation')) {
          return createErrorResponse('VALIDATION_ERROR', error.message);
        }

        // Default server error
        return createErrorResponse(
          'SERVER_ERROR',
          'An unexpected error occurred',
        );
      }
    };

    return descriptor;
  };
}
