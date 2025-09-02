"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.DatabaseError = exports.TelegramAPIError = exports.RateLimitError = exports.ValidationError = exports.CustomError = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importDefault(require("../utils/cache"));
class CustomError extends Error {
    constructor(message, statusCode = 500, isOperational = true, context) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.CustomError = CustomError;
class ValidationError extends CustomError {
    constructor(message, context) {
        super(message, 400, true, context);
    }
}
exports.ValidationError = ValidationError;
class RateLimitError extends CustomError {
    constructor(message, context) {
        super(message, 429, true, context);
    }
}
exports.RateLimitError = RateLimitError;
class TelegramAPIError extends CustomError {
    constructor(message, context) {
        super(message, 502, true, context);
    }
}
exports.TelegramAPIError = TelegramAPIError;
class DatabaseError extends CustomError {
    constructor(message, context) {
        super(message, 500, true, context);
    }
}
exports.DatabaseError = DatabaseError;
class ErrorHandler {
    static handleError(error, context) {
        const isOperationalError = error instanceof CustomError && error.isOperational;
        if (isOperationalError) {
            ErrorHandler.handleOperationalError(error, context);
        }
        else {
            ErrorHandler.handleCriticalError(error, context);
        }
    }
    static handleOperationalError(error, context) {
        logger_1.default.error('Operational error occurred', error, {
            statusCode: error.statusCode,
            context: error.context || context,
            isOperational: error.isOperational
        });
    }
    static handleCriticalError(error, context) {
        logger_1.default.error('Critical error occurred', error, {
            context,
            isCritical: true
        });
        if (process.env.NODE_ENV === 'production') {
            setTimeout(() => {
                logger_1.default.error('Performing graceful shutdown due to critical error');
                process.exit(1);
            }, 1000);
        }
    }
    static createTelegramMiddleware() {
        return async (ctx, next) => {
            try {
                await next();
            }
            catch (error) {
                const telegramError = error;
                const errorContext = {
                    updateId: ctx.update?.update_id,
                    updateType: ctx.updateType,
                    chatId: ctx.chat?.id,
                    userId: ctx.from?.id,
                    messageId: 'message' in ctx.update && ctx.update.message?.message_id
                };
                if (telegramError.code) {
                    ErrorHandler.handleTelegramAPIError(telegramError, errorContext);
                }
                else if (error instanceof CustomError) {
                    ErrorHandler.handleOperationalError(error, errorContext);
                }
                else {
                    ErrorHandler.handleCriticalError(error, errorContext);
                }
                if (ctx.chat && !telegramError.code) {
                    try {
                        await ctx.reply('⚠️ Si è verificato un errore temporaneo. Riprova più tardi.');
                    }
                    catch (replyError) {
                        logger_1.default.error('Failed to send error message to user', replyError);
                    }
                }
            }
        };
    }
    static handleTelegramAPIError(telegramError, context) {
        const errorMessage = telegramError.description || telegramError.message || 'Unknown Telegram API error';
        switch (telegramError.code) {
            case 400:
                if (errorMessage.includes('chat not found')) {
                    logger_1.default.warn('Chat not found', { ...context, telegramError });
                }
                else if (errorMessage.includes('user not found')) {
                    logger_1.default.warn('User not found', { ...context, telegramError });
                }
                else {
                    logger_1.default.error('Bad Request to Telegram API', new TelegramAPIError(errorMessage), context);
                }
                break;
            case 401:
                logger_1.default.error('Unauthorized - Invalid bot token', new TelegramAPIError(errorMessage), context);
                break;
            case 403:
                if (errorMessage.includes('blocked')) {
                    logger_1.default.info('Bot blocked by user', { ...context, telegramError });
                }
                else if (errorMessage.includes('kicked')) {
                    logger_1.default.warn('Bot kicked from chat', { ...context, telegramError });
                }
                else {
                    logger_1.default.warn('Forbidden action', { ...context, telegramError });
                }
                break;
            case 429:
                logger_1.default.warn('Rate limited by Telegram API', { ...context, telegramError });
                break;
            case 500:
            case 502:
            case 503:
            case 504:
                logger_1.default.error('Telegram API server error', new TelegramAPIError(errorMessage), context);
                break;
            default:
                logger_1.default.error('Unknown Telegram API error', new TelegramAPIError(errorMessage), {
                    ...context,
                    code: telegramError.code
                });
        }
    }
    static createRateLimitMiddleware(maxRequests = 30, timeWindow = 60) {
        return async (ctx, next) => {
            const userId = ctx.from?.id;
            const chatId = ctx.chat?.id;
            if (!userId) {
                return next();
            }
            const identifier = `${userId}:${chatId || 'private'}`;
            if (!cache_1.default.checkRateLimit(`middleware:${identifier}`, maxRequests, timeWindow)) {
                logger_1.default.warn('Rate limit exceeded', {
                    userId,
                    chatId,
                    maxRequests,
                    timeWindow
                });
                throw new RateLimitError('Rate limit exceeded. Please slow down.', {
                    userId,
                    chatId,
                    maxRequests,
                    timeWindow
                });
            }
            return next();
        };
    }
    static createValidationMiddleware() {
        return async (ctx, next) => {
            const allowedBotUpdateTypes = [
                'my_chat_member',
                'chat_member',
            ];
            if (!ctx.from || (ctx.from.is_bot && !allowedBotUpdateTypes.includes(ctx.updateType))) {
                logger_1.default.warn('Invalid request from bot user', {
                    from: ctx.from,
                    updateType: ctx.updateType,
                    allowed: allowedBotUpdateTypes.includes(ctx.updateType)
                });
                throw new ValidationError('Requests from bot users are not allowed', {
                    from: ctx.from,
                    updateType: ctx.updateType
                });
            }
            if (ctx.from?.is_bot && allowedBotUpdateTypes.includes(ctx.updateType)) {
                logger_1.default.debug('Processing allowed bot update', {
                    from: ctx.from,
                    updateType: ctx.updateType,
                    chatId: ctx.chat?.id
                });
            }
            return next();
        };
    }
}
exports.ErrorHandler = ErrorHandler;
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception', error);
    ErrorHandler.handleCriticalError(error);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
        promise: promise.toString()
    });
    ErrorHandler.handleCriticalError(reason instanceof Error ? reason : new Error(String(reason)));
});
exports.default = ErrorHandler;
//# sourceMappingURL=ErrorHandler.js.map