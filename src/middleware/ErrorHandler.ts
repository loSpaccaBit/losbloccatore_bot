import { Context, MiddlewareFn } from 'telegraf';
import logger from '../utils/logger';
import cache from '../utils/cache';

export class CustomError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public context?: any;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, context?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, context?: any) {
    super(message, 400, true, context);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string, context?: any) {
    super(message, 429, true, context);
  }
}

export class TelegramAPIError extends CustomError {
  constructor(message: string, context?: any) {
    super(message, 502, true, context);
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string, context?: any) {
    super(message, 500, true, context);
  }
}

export class ErrorHandler {
  static handleError(error: Error, context?: any): void {
    const isOperationalError = error instanceof CustomError && error.isOperational;

    if (isOperationalError) {
      ErrorHandler.handleOperationalError(error as CustomError, context);
    } else {
      ErrorHandler.handleCriticalError(error, context);
    }
  }

  static handleOperationalError(error: CustomError, context?: any): void {
    logger.error('Operational error occurred', error, {
      statusCode: error.statusCode,
      context: error.context || context,
      isOperational: error.isOperational
    });
  }

  static handleCriticalError(error: Error, context?: any): void {
    logger.error('Critical error occurred', error, {
      context,
      isCritical: true
    });

    // In production, you might want to:
    // 1. Send alerts to monitoring system
    // 2. Restart the application
    // 3. Send notifications to administrators
    
    if (process.env.NODE_ENV === 'production') {
      // Example: Send alert to monitoring system
      // await sendAlertToMonitoring(error, context);
      
      // Example: Graceful shutdown for critical errors
      setTimeout(() => {
        logger.error('Performing graceful shutdown due to critical error');
        process.exit(1);
      }, 1000);
    }
  }

  static createTelegramMiddleware(): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      try {
        await next();
      } catch (error) {
        const telegramError = error as any;
        
        // Extract context information
        const errorContext = {
          updateId: ctx.update?.update_id,
          updateType: ctx.updateType,
          chatId: ctx.chat?.id,
          userId: ctx.from?.id,
          messageId: 'message' in ctx.update && ctx.update.message?.message_id
        };

        // Handle specific Telegram API errors
        if (telegramError.code) {
          ErrorHandler.handleTelegramAPIError(telegramError, errorContext);
        } else if (error instanceof CustomError) {
          ErrorHandler.handleOperationalError(error, errorContext);
        } else {
          ErrorHandler.handleCriticalError(error as Error, errorContext);
        }

        // Send user-friendly error message if possible
        if (ctx.chat && !telegramError.code) {
          try {
            await ctx.reply('⚠️ Si è verificato un errore temporaneo. Riprova più tardi.');
          } catch (replyError) {
            logger.error('Failed to send error message to user', replyError as Error);
          }
        }
      }
    };
  }

  static handleTelegramAPIError(telegramError: any, context: any): void {
    const errorMessage = telegramError.description || telegramError.message || 'Unknown Telegram API error';
    
    switch (telegramError.code) {
      case 400:
        if (errorMessage.includes('chat not found')) {
          logger.warn('Chat not found', { ...context, telegramError });
        } else if (errorMessage.includes('user not found')) {
          logger.warn('User not found', { ...context, telegramError });
        } else {
          logger.error('Bad Request to Telegram API', new TelegramAPIError(errorMessage), context);
        }
        break;
        
      case 401:
        logger.error('Unauthorized - Invalid bot token', new TelegramAPIError(errorMessage), context);
        break;
        
      case 403:
        if (errorMessage.includes('blocked')) {
          logger.info('Bot blocked by user', { ...context, telegramError });
        } else if (errorMessage.includes('kicked')) {
          logger.warn('Bot kicked from chat', { ...context, telegramError });
        } else {
          logger.warn('Forbidden action', { ...context, telegramError });
        }
        break;
        
      case 429:
        logger.warn('Rate limited by Telegram API', { ...context, telegramError });
        break;
        
      case 500:
      case 502:
      case 503:
      case 504:
        logger.error('Telegram API server error', new TelegramAPIError(errorMessage), context);
        break;
        
      default:
        logger.error('Unknown Telegram API error', new TelegramAPIError(errorMessage), {
          ...context,
          code: telegramError.code
        });
    }
  }

  static createRateLimitMiddleware(maxRequests: number = 30, timeWindow: number = 60): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      
      if (!userId) {
        return next();
      }

      const identifier = `${userId}:${chatId || 'private'}`;
      
      if (!cache.checkRateLimit(`middleware:${identifier}`, maxRequests, timeWindow)) {
        logger.warn('Rate limit exceeded', {
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

  static createValidationMiddleware(): MiddlewareFn<Context> {
    return async (ctx: Context, next) => {
      // Allow certain update types from bot users (when the bot itself is added/removed from channels)
      const allowedBotUpdateTypes = [
        'my_chat_member',     // Bot added/removed from chat
        'chat_member',        // Any member status change (including bot)
      ];

      // Basic validation checks
      if (!ctx.from || (ctx.from.is_bot && !allowedBotUpdateTypes.includes(ctx.updateType))) {
        logger.warn('Invalid request from bot user', {
          from: ctx.from,
          updateType: ctx.updateType,
          allowed: allowedBotUpdateTypes.includes(ctx.updateType)
        });
        
        throw new ValidationError('Requests from bot users are not allowed', {
          from: ctx.from,
          updateType: ctx.updateType
        });
      }

      // For allowed bot updates, log but continue processing
      if (ctx.from?.is_bot && allowedBotUpdateTypes.includes(ctx.updateType)) {
        logger.debug('Processing allowed bot update', {
          from: ctx.from,
          updateType: ctx.updateType,
          chatId: ctx.chat?.id
        });
      }

      return next();
    };
  }
}

// Global process error handlers
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  ErrorHandler.handleCriticalError(error);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise: promise.toString()
  });
  ErrorHandler.handleCriticalError(reason instanceof Error ? reason : new Error(String(reason)));
});

export default ErrorHandler;