export class InstagramApiException extends Error {
  constructor(
    message: string,
    public readonly originalError?: any,
  ) {
    super(message);
    this.name = 'InstagramApiException';

    // Parse Instagram-specific error codes
    if (originalError?.response?.data?.error) {
      const { code, message: apiMessage } = originalError.response.data.error;
      this.message = `Instagram API Error ${code}: ${apiMessage}`;
    }
  }

  get statusCode(): number {
    if (this.originalError?.response?.status) {
      return this.originalError.response.status;
    }
    return 500;
  }

  get errorCode(): string {
    if (this.originalError?.response?.data?.error?.code) {
      return this.originalError.response.data.error.code;
    }
    return 'unknown';
  }
}
