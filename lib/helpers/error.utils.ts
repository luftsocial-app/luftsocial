import { HttpStatus } from '@nestjs/common';
import {
  ZodValidationError,
  AuthenticationError,
  NotFoundError,
} from './error';

/**
 * Returns an appropriate HTTP status code based on the error type.
 */
export function getErrorCode(error: unknown): number {
  if (error instanceof ZodValidationError) return error.getErrorCode();
  if (error instanceof AuthenticationError) return error.getErrorCode();
  if (error instanceof NotFoundError) return error.getErrorCode();
  return HttpStatus.INTERNAL_SERVER_ERROR; // Default to 500
}

/**
 * Returns a standardized error object from known error types.
 */
export function getErrorObject(
  error: unknown,
): Record<string, any> | undefined {
  if (error instanceof ZodValidationError) return error.getErrorObject();
  if (error instanceof AuthenticationError) return error.getErrorObject();
  if (error instanceof NotFoundError) return error.getErrorObject();
  return { message: 'An unexpected error occurred' };
}

/**
 * Extracts and formats an error message.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error instanceof ZodValidationError) return error.message;
  if (error instanceof AuthenticationError) return error.message;
  if (error instanceof NotFoundError) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'An unexpected error occurred';
}

/**
 * Logs error details for debugging.
 */
export function logError(error: unknown): void {
  if (error instanceof Error) {
    console.error('Error Message:', error.message);
    console.error('Stack Trace:', error.stack);
  } else {
    console.error('Unknown Error:', error);
  }
}
