import { Telegraf, Context } from 'telegraf';
import config from '../../config';
import logger from '../../utils/logger';

/**
 * Core Telegram Bot Service
 * Handles bot initialization, lifecycle, and error handling
 * Provides the foundation for other Telegram services
 */
export class TelegramCoreService {
  private bot: Telegraf;
  private isPolling = false;

  constructor() {
    this.bot = new Telegraf(config.token);
    this.setupErrorHandling();
    logger.info('TelegramCoreService initialized');
  }

  /**
   * Setup global error handling for the bot
   */
  private setupErrorHandling(): void {
    this.bot.catch((err: any, ctx: Context) => {
      logger.error('Telegram bot error occurred', err, {
        updateId: ctx.update?.update_id,
        updateType: ctx.updateType,
        chatId: ctx.chat?.id,
        userId: ctx.from?.id
      });
    });
  }

  /**
   * Get the Telegraf bot instance
   * Used by other services to access bot functionality
   */
  getBot(): Telegraf {
    return this.bot;
  }

  /**
   * Start bot polling with explicit allowed updates
   */
  async startPolling(): Promise<void> {
    if (this.isPolling) {
      logger.warn('Bot is already polling');
      return;
    }

    try {
      // Configure allowed updates to include chat member events
      const allowedUpdates = [
        'message',
        'edited_message',
        'channel_post',
        'edited_channel_post',
        'inline_query',
        'chosen_inline_result',
        'callback_query',
        'shipping_query',
        'pre_checkout_query',
        'poll',
        'poll_answer',
        'my_chat_member',
        'chat_member',
        'chat_join_request'
      ];

      logger.info('Starting bot polling with allowed updates', {
        allowedUpdates,
        totalUpdates: allowedUpdates.length
      });

      await this.bot.launch({
        allowedUpdates: allowedUpdates as any
      });
      
      this.isPolling = true;
      logger.info('✅ Bot polling started successfully with chat_member updates enabled');
    } catch (error) {
      logger.error('❌ Failed to start bot polling', error as Error);
      throw error;
    }
  }

  /**
   * Stop bot polling gracefully
   */
  async stop(): Promise<void> {
    if (!this.isPolling) {
      logger.warn('Bot is not currently polling');
      return;
    }

    try {
      await this.bot.stop();
      this.isPolling = false;
      logger.info('✅ Bot polling stopped gracefully');
    } catch (error) {
      logger.error('❌ Error stopping bot', error as Error);
      throw error;
    }
  }

  /**
   * Check if bot is currently polling
   */
  isCurrentlyPolling(): boolean {
    return this.isPolling;
  }

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<any> {
    try {
      return await this.bot.telegram.getMe();
    } catch (error) {
      logger.error('Failed to get bot info', error as Error);
      throw error;
    }
  }

  /**
   * Health check for the bot service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.bot.telegram.getMe();
      return true;
    } catch (error) {
      logger.error('Bot health check failed', error as Error);
      return false;
    }
  }
}