import { Context } from 'telegraf';
import logger from '../utils/logger';
import tikTokService from '../services/TikTokService';

export class TikTokTrackingMiddleware {
  /**
   * Middleware to track TikTok link clicks and interactions
   */
  static createTikTokTrackingMiddleware() {
    return async (ctx: Context, next: () => Promise<void>) => {
      try {
        // Check if this is a message with text
        if ('message' in ctx.update && 'text' in ctx.update.message) {
          const message = ctx.update.message;
          const userId = message.from?.id;
          const userName = message.from?.first_name || 'User';
          const text = message.text;

          if (userId && text) {
            // Check if the message contains a TikTok URL
            const tiktokUrl = tikTokService.extractTikTokUrl(text);
            if (tiktokUrl) {
              logger.info('TikTok link detected in message', {
                userId,
                userName,
                chatId: message.chat.id,
                chatType: message.chat.type,
                tiktokUrl,
                messageId: message.message_id,
                timestamp: new Date(message.date * 1000).toISOString()
              });

              // Log for analytics - this helps track engagement
              logger.info('TikTok engagement tracked', {
                event: 'tiktok_link_shared',
                userId,
                userName,
                url: tiktokUrl,
                source: message.chat.type === 'private' ? 'private_chat' : 'group_chat'
              });
            }
          }
        }

        // Check if this is a callback query (inline button clicks)
        if ('callback_query' in ctx.update) {
          const callbackQuery = ctx.update.callback_query;
          const userId = callbackQuery.from.id;
          const userName = callbackQuery.from.first_name || 'User';
          
          if ('data' in callbackQuery && callbackQuery.data && callbackQuery.data.includes('tiktok')) {
            logger.info('TikTok related callback query', {
              userId,
              userName,
              callbackData: callbackQuery.data,
              messageId: callbackQuery.message?.message_id,
              timestamp: new Date().toISOString()
            });
          }
        }

        // Continue to next middleware/handler
        await next();

      } catch (error) {
        logger.error('Error in TikTok tracking middleware', error as Error, {
          updateType: ctx.updateType,
          updateId: ctx.update?.update_id
        });
        
        // Don't block the request, continue anyway
        await next();
      }
    };
  }

  /**
   * Middleware specifically for tracking user interactions with TikTok content
   */
  static createTikTokInteractionMiddleware() {
    return async (ctx: Context, next: () => Promise<void>) => {
      try {
        const startTime = Date.now();

        // Execute the handler
        await next();

        const duration = Date.now() - startTime;

        // Log TikTok related interactions that took a while (processing)
        if (duration > 1000 && 'message' in ctx.update) {
          const message = ctx.update.message;
          if ('text' in message && message.text) {
            const tiktokUrl = tikTokService.extractTikTokUrl(message.text);
            if (tiktokUrl) {
              logger.info('TikTok message processing completed', {
                userId: message.from?.id,
                userName: message.from?.first_name,
                processingDuration: duration,
                tiktokUrl,
                wasProcessed: true
              });
            }
          }
        }

      } catch (error) {
        logger.error('Error in TikTok interaction middleware', error as Error, {
          updateType: ctx.updateType
        });
        throw error; // Re-throw to let error handler deal with it
      }
    };
  }
}