import { Context, MiddlewareFn } from 'telegraf';
export declare class CustomError extends Error {
    statusCode: number;
    isOperational: boolean;
    context?: any;
    constructor(message: string, statusCode?: number, isOperational?: boolean, context?: any);
}
export declare class ValidationError extends CustomError {
    constructor(message: string, context?: any);
}
export declare class RateLimitError extends CustomError {
    constructor(message: string, context?: any);
}
export declare class TelegramAPIError extends CustomError {
    constructor(message: string, context?: any);
}
export declare class DatabaseError extends CustomError {
    constructor(message: string, context?: any);
}
export declare class ErrorHandler {
    static handleError(error: Error, context?: any): void;
    static handleOperationalError(error: CustomError, context?: any): void;
    static handleCriticalError(error: Error, context?: any): void;
    static createTelegramMiddleware(): MiddlewareFn<Context>;
    static handleTelegramAPIError(telegramError: any, context: any): void;
    static createRateLimitMiddleware(maxRequests?: number, timeWindow?: number): MiddlewareFn<Context>;
    static createValidationMiddleware(): MiddlewareFn<Context>;
}
export default ErrorHandler;
//# sourceMappingURL=ErrorHandler.d.ts.map