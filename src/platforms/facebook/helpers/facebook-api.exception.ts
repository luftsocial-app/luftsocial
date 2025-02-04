export class FacebookApiException extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'FacebookApiException';
    }

    static fromError(error: any): FacebookApiException {
        if (error.response?.data?.error) {
            const { code, message } = error.response.data.error;
            return new FacebookApiException(
                error.response.status,
                code.toString(),
                message
            );
        }
        return new FacebookApiException(500, 'unknown', error.message);
    }
}