import { HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from '@nestjs/common';

const errorLog = new Logger('ErrorLogger');

export function appError(
    message: string = 'An unexpected error occurred',
    statusCode: number = 400, // Default to BadRequest (HTTP 400)
    errorCode: string = 'UNKNOWN_ERROR', // Default error code
  ): Error {
    // Initialize response with default values
    let response: { message?: string; statusCode: number; errorCode: string } = {
      statusCode,
      errorCode,
    };
  
    // Set the message if it is different from the default
    if (message !== 'An unexpected error occurred') {
      response.message = message;
    }
  
    // Remove properties that are set to default values
    Object.keys(response).forEach((key) => {
      if (
        (response[key] === 'An unexpected error occurred' && key === 'message') ||
        (response[key] === 'UNKNOWN_ERROR' && key === 'errorCode') ||
        (response[key] === 400 && key === 'statusCode')
      ) {
        delete response[key];
      }
    });
  
    // Create the error object
    const error = new Error();
    error.message = response.message || 'An unexpected error occurred'; 
  
    // Attach custom properties
    (error as any).statusCode = response.statusCode;
    (error as any).errorCode = response.errorCode;

    console.log(error);
  
    return error;
  }
  
  
  export function notFoundError(message: string = 'Not found', error: any = null) {
    const errorMessage = message || 'Not found';
    return new NotFoundError(errorMessage, error);
  }
  

export class ZodValidationError extends Error {
  private error: any;

  constructor(message: string, error: any = null) {
    super(message);
    this.error = error;
    errorLog.error(message);
  }

  /**
   * Returns an error object mapping validation fields to error messages.
   */
  getErrorObject(): Record<string, string> {
    const errorObject: Record<string, string> = {};

    if (this.error?.details && Array.isArray(this.error.details)) {
      this.error.details.forEach((detail: any) => {
        if (detail.context?.key) {
          errorObject[detail.context.key] = detail.message;
        }
      });
    }

    return errorObject;
  }

  /**
   * Returns the HTTP status code for validation errors.
   */
  getErrorCode(): number {
    return 400;
  }
}

export class AuthenticationError extends Error {
  private error: any;

  constructor(message: string, error: any = null) {
    super(message);
    this.error = error;
    errorLog.error(message);
  }

  /**
   * Returns an empty object for authentication errors (customize if needed).
   */
  getErrorObject(): Record<string, any> {
    return {};
  }

  /**
   * Returns the HTTP status code for authentication errors.
   */
  getErrorCode(): number {
    return 401;
  }
}

export class NotFoundError extends Error {
  private error: any;

  constructor(message: string, error: any = null) {
    super(message);
    this.error = error;
    errorLog.error(message);
  }

  /**
   * Returns an empty object for not found errors (customize if needed).
   */
  getErrorObject(): Record<string, any> {
    return {};
  }

  /**
   * Returns the HTTP status code for not found errors.
   */
  getErrorCode(): number {
    return 404;
  }
}

/**
 * Helper function to determine error codes dynamically.
 */
export function getErrorCode(error: Error): number {
  if (error instanceof ZodValidationError) return error.getErrorCode();
  if (error instanceof AuthenticationError) return error.getErrorCode();
  if (error instanceof NotFoundError) return error.getErrorCode();
  return 500; // Default to internal server error
}

/**
 * Helper function to return a standardized error object.
 */
export function getErrorObject(error: Error): Record<string, any> {
  if (error instanceof ZodValidationError) return error.getErrorObject();
  if (error instanceof AuthenticationError) return error.getErrorObject();
  if (error instanceof NotFoundError) return error.getErrorObject();
  return {}; // Default empty object
}
