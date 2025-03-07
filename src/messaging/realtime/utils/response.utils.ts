import {
  SuccessResponse,
  ErrorResponse,
} from '../interfaces/socket.interfaces';

/**
 * Creates a standardized success response
 *
 * @param data Additional data to include in the response
 * @returns A formatted success response
 */
export function createSuccessResponse(data: any = {}): SuccessResponse {
  return {
    success: true,
    ...data,
  };
}

/**
 * Creates a standardized error response
 *
 * @param code Error code
 * @param message Human-readable error message
 * @returns A formatted error response
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
 * Validates payload against required fields
 *
 * @param payload The payload to validate
 * @param requiredFields Array of field names that must be present
 * @returns Error message or null if validation passes
 */
export function validatePayload(
  payload: any,
  requiredFields: string[],
): string | null {
  if (!payload) {
    return 'Payload is required';
  }

  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      return `Missing required field: ${field}`;
    }

    if (Array.isArray(payload[field]) && payload[field].length === 0) {
      return `Field ${field} cannot be empty`;
    }
  }

  return null;
}
