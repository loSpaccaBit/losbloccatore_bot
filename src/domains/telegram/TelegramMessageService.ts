import { TelegramCoreService } from './TelegramCoreService';
import { GoodbyeMessageOptions } from '../../types';
import messageService from '../../services/MessageService';
import logger from '../../utils/logger';
import cache from '../../utils/cache';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Telegram Message Service
 * Handles all message sending operations, formatting, and text processing
 */
export class TelegramMessageService {
  private coreService: TelegramCoreService;

  constructor(coreService: TelegramCoreService) {
    this.coreService = coreService;
    logger.info('TelegramMessageService initialized');
  }

  /**
   * Escapes special characters in text for Telegram Markdown
   * Handles @ and _ characters that can conflict with Markdown parsing
   */
  private escapeMarkdownSpecialChars(text: string): string {
    // First, escape @ symbols in usernames to prevent mention conflicts
    text = text.replace(/@([a-zA-Z0-9_]+)/g, '\\@$1');
    
    // Then escape all underscores (simpler approach)
    // This will escape ALL underscores, not just those in usernames
    text = text.replace(/_/g, '\\_');
    
    return text;
  }

  /**
   * Processes text for safe Markdown parsing by escaping special characters
   * Public method for use by handlers
   */
  processMarkdownText(text: string): string {
    return this.escapeMarkdownSpecialChars(text);
  }

  /**
   * Send welcome message with TikTok integration for new users
   */
  async sendWelcomeWithTikTok(userId: number, userName: string, referralLink: string): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      
      // Generate callback data for TikTok button
      const tiktokCallbackData = `tiktok_points:${userId}`;
      
      // Load welcome message template
      let messageText: string;
      try {
        messageText = await messageService.loadMessage('welcome_with_tiktok', {
          variables: {
            userName,
            referralLink
          }
        });
      } catch (templateError) {
        logger.warn('Failed to load welcome template, using fallback', { userId, error: templateError });
        messageText = `🎉 Benvenuto ${userName}!\n\nCompleta il task TikTok per guadagnare punti e invita i tuoi amici!\n\n🔗 Il tuo link: ${referralLink}`;
      }

      // Try to load and send welcome photo
      try {
        const photoPath = join(process.cwd(), 'media', 'istruzioni.png');
        const photoBuffer = await readFile(photoPath);
        
        await bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
          caption: messageText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎵 Apri TikTok', url: await this.getTikTokUrl() }
              ],
              [
                { text: '✅ Ho visitato TikTok', callback_data: tiktokCallbackData }
              ]
            ]
          }
        });

        // Cache welcome message timestamp for TikTok timing validation
        const welcomeTimestamp = Date.now();
        cache.set(`welcome_sent:${userId}`, welcomeTimestamp, 1800); // 30 minutes TTL

        logger.info('Welcome message with photo sent successfully', { userId, userName, welcomeTimestamp });
        return true;

      } catch (photoError) {
        logger.warn('Failed to send photo, sending text message instead', { 
          userId, 
          userName, 
          error: photoError 
        });

        // Fallback to text message with buttons
        await bot.telegram.sendMessage(userId, messageText, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎵 Apri TikTok', url: await this.getTikTokUrl() }
              ],
              [
                { text: '✅ Ho visitato TikTok', callback_data: tiktokCallbackData }
              ]
            ]
          }
        });

        // Cache welcome message timestamp for TikTok timing validation
        const welcomeTimestamp = Date.now();
        cache.set(`welcome_sent:${userId}`, welcomeTimestamp, 1800); // 30 minutes TTL

        logger.info('Welcome text message sent successfully', { userId, userName, welcomeTimestamp });
        return true;
      }

    } catch (error) {
      logger.error('Failed to send welcome message with TikTok', error as Error, {
        userId,
        userName,
        referralLink
      });
      return false;
    }
  }

  /**
   * Send welcome message for returning users (without TikTok task)
   */
  async sendWelcomeReturningUser(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      
      // Load returning user welcome template
      let messageText: string;
      try {
        messageText = await messageService.loadMessage('welcome_returning_user', {
          variables: {
            userName,
            totalPoints: totalPoints.toString(),
            referralLink
          }
        });
      } catch (templateError) {
        logger.warn('Failed to load returning user template, using fallback', { userId, error: templateError });
        messageText = `🎉 Bentornato ${userName}!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${referralLink}\n\nContinua a invitare amici per guadagnare altri punti!`;
      }

      await bot.telegram.sendMessage(userId, messageText, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👥 Invita Amici', url: referralLink }
            ]
          ]
        }
      });

      logger.info('Returning user welcome message sent successfully', { userId, userName, totalPoints });
      return true;

    } catch (error) {
      logger.error('Failed to send returning user welcome message', error as Error, {
        userId,
        userName,
        totalPoints,
        referralLink
      });
      return false;
    }
  }

  /**
   * Send TikTok points success message
   */
  async sendTikTokPointsMessage(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      
      // Load TikTok success template
      let messageText: string;
      try {
        messageText = await messageService.loadMessage('tiktok_points_earned', {
          variables: {
            userName,
            totalPoints: totalPoints.toString(),
            referralLink
          }
        });
      } catch (templateError) {
        logger.warn('Failed to load TikTok success template, using fallback', { userId, error: templateError });
        messageText = `🎉 Complimenti ${userName}!\n\nHai completato il task TikTok: +3 punti!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${referralLink}\n\nContinua a invitare amici per guadagnare altri punti!`;
      }

      try {
        await bot.telegram.sendMessage(userId, messageText, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👥 Invita Amici', url: referralLink }
              ]
            ]
          }
        });
      } catch (markdownError: any) {
        if (markdownError.message?.includes('parse entities')) {
          logger.warn('Markdown parsing failed in TikTok success message, sending without formatting', { 
            userId, 
            error: markdownError.message 
          });
          // Fallback without markdown
          await bot.telegram.sendMessage(userId, messageText.replace(/[*_`\[\]()]/g, ''), {
            link_preview_options: { is_disabled: true },
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👥 Invita Amici', url: referralLink }
                ]
              ]
            }
          });
        } else {
          throw markdownError;
        }
      }

      logger.info('TikTok points message sent successfully', { userId, userName, totalPoints });
      return true;

    } catch (error) {
      logger.error('Failed to send TikTok points message', error as Error, {
        userId,
        userName,
        totalPoints,
        referralLink
      });
      return false;
    }
  }

  /**
   * Send goodbye message to user who left
   */
  async sendGoodbyeMessage(userId: number, userName: string, options?: GoodbyeMessageOptions): Promise<boolean> {
    logger.info('TelegramMessageService: Starting goodbye message send', {
      userId,
      userName,
      options,
      step: 'start'
    });

    try {
      const goodbyeText = await this.getGoodbyeMessage(userName, options);
      
      logger.info('TelegramMessageService: Goodbye message text prepared', {
        userId,
        userName,
        messageLength: goodbyeText.length,
        messagePreview: goodbyeText.substring(0, 100) + '...',
        step: 'text_prepared'
      });

      const bot = this.coreService.getBot();

      logger.info('TelegramMessageService: About to send message via Telegram API', {
        userId,
        userName,
        step: 'before_api_call'
      });

      await bot.telegram.sendMessage(userId, goodbyeText, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true }
      });

      logger.info('TelegramMessageService: Goodbye message sent successfully via API', { 
        userId, 
        userName,
        step: 'api_success'
      });
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as any)?.code || 'unknown';
      
      logger.error('TelegramMessageService: Failed to send goodbye message', error as Error, {
        userId,
        userName,
        errorMessage,
        errorCode,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        step: 'api_error'
      });
      
      // Log specific Telegram errors for debugging
      if (errorMessage.includes('blocked') || errorMessage.includes('Forbidden')) {
        logger.warn('TelegramMessageService: User has blocked the bot or privacy settings prevent message', {
          userId,
          userName,
          errorMessage
        });
      } else if (errorMessage.includes('not found') || errorMessage.includes('chat not found')) {
        logger.warn('TelegramMessageService: Chat not found - user may have deleted account', {
          userId,
          userName,
          errorMessage
        });
      }
      
      return false;
    }
  }

  /**
   * Get formatted goodbye message
   */
  private async getGoodbyeMessage(userName: string, options?: GoodbyeMessageOptions): Promise<string> {
    try {
      // Try to load from message service first
      return await messageService.loadMessage('goodbye', {
        variables: {
          userName,
          includeReturnMessage: options?.includeReturnMessage ? 'true' : 'false'
        }
      });
    } catch (templateError) {
      logger.warn('Failed to load goodbye template, using fallback', { userName, error: templateError });
      
      // Fallback goodbye message
      let message = `👋 Ciao ${userName}!\n\nCi dispiace vederti andare.`;
      
      if (options?.includeReturnMessage) {
        message += `\n\n🔄 *Potrai sempre tornare quando vuoi!*\nIl canale ti aspetta.`;
      }
      
      return message;
    }
  }

  /**
   * Send photo message with fallback to text
   */
  async sendPhoto(chatId: number, photoPath: string, caption?: string, options?: any): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      const photoBuffer = await readFile(photoPath);
      
      await bot.telegram.sendPhoto(chatId, { source: photoBuffer }, {
        caption,
        ...options
      });

      logger.info('Photo sent successfully', { chatId, photoPath });
      return true;

    } catch (error) {
      logger.warn('Failed to send photo, attempting text fallback', { 
        chatId, 
        photoPath, 
        error 
      });

      // Fallback to text message if photo fails
      if (caption) {
        try {
          const bot = this.coreService.getBot();
          await bot.telegram.sendMessage(chatId, caption, options);
          logger.info('Text fallback sent successfully', { chatId });
          return true;
        } catch (textError) {
          logger.error('Text fallback also failed', textError as Error, { chatId });
        }
      }

      return false;
    }
  }

  /**
   * Get TikTok URL from message service
   */
  private async getTikTokUrl(): Promise<string> {
    try {
      return await messageService.getSetting('TIKTOK_URL', 'https://www.tiktok.com/@lo_sbloccatore');
    } catch (error) {
      logger.warn('Failed to get TikTok URL from settings, using default');
      return 'https://www.tiktok.com/@lo_sbloccatore';
    }
  }
}