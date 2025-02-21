export class TikTokApiException extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: any,
  ) {
    super(message);
    this.name = 'TikTokApiException';
  }

  static fromError(error: any): TikTokApiException {
    if (error.response?.data?.error) {
      return new TikTokApiException(
        error.response.data.error.message,
        error.response.data.error.code,
      );
    }
    return new TikTokApiException('Unknown TikTok API error');
  }
}
