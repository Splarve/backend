/**
 * Custom error class for application-specific errors, especially those
 * that map to HTTP status codes.
 */
export class AppError extends Error {
    statusCode: number;
    context?: Record<string, any>; // Optional context for logging/debugging

    constructor(message: string, statusCode: number = 500, context?: Record<string, any>) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.context = context;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
} 