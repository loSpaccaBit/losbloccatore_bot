import { Telegraf, Context } from 'telegraf';
import { GoodbyeMessageOptions } from '../types/index';
import config from '../config/index';
import logger from '../utils/logger';
import cache from '../utils/cache';
import messageService from './MessageService';
import { readFile } from 'fs/promises';
import { join } from 'path';

export class TelegramService {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(config.token);
    this.setupErrorHandling();
  }

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
   * Public method for use by controllers
   */
  public processMarkdownText(text: string): string {
    return this.escapeMarkdownSpecialChars(text);
  }


  async sendWelcomeWithTikTok(
    userId: number, 
    userName: string,
    referralLink?: string
  ): Promise<boolean> {
    // Check if welcome message was already sent
    if (cache.isWelcomeMessageSent(userId)) {
      logger.debug('TikTok welcome message already sent to user', { userId, userName });
      return true;
    }

    // Rate limiting check
    if (!cache.checkRateLimit(`welcome:${userId}`, 1, 300)) {
      logger.warn('TikTok welcome message rate limit exceeded', { userId, userName });
      return false;
    }

    try {
      // Get TikTok URL and image path from settings
      const [tiktokUrl, welcomeImage] = await Promise.all([
        messageService.getSetting('TIKTOK_URL', 'https://www.tiktok.com/@lo_sbloccatore'),
        messageService.getSetting('WELCOME_IMAGE', 'istruzioni.png')
      ]);

      const variables: any = {
        userName,
        tiktokUrl,
        includeRules: true,
        welcomeImage: welcomeImage
      };

      // Add referralLink only if provided
      if (referralLink) {
        variables.referralLink = referralLink;
      }

      // Get message metadata with processed variables
      const metadata = await messageService.getMessageMetadata('welcome_with_tiktok', variables);
      
      const messageContent = await messageService.loadMessage('welcome_with_tiktok', {
        variables
      });

      // Create inline keyboard with direct TikTok URL and points tracker
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎵 Apri TikTok',
                url: tiktokUrl
              }
            ],
            [
              {
                text: '✅ Ho visitato TikTok - Guadagna 3 punti!',
                callback_data: `tiktok_points:${userId}`
              }
            ]
          ]
        }
      };

      // Check if message has image metadata or fallback to settings
      const imagePath = metadata.IMAGE || welcomeImage;
      
      if (imagePath && imagePath.trim()) {
        try {
          // Send with photo
          const photoFilePath = join(process.cwd(), 'media', imagePath.trim());
          const photoBuffer = await readFile(photoFilePath);
          
          try {
            await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
              caption: messageContent,
              parse_mode: 'Markdown',
              ...inlineKeyboard
            });
          } catch (markdownError: any) {
            if (markdownError.message?.includes('parse entities')) {
              logger.warn('Markdown parsing failed in photo caption, sending without formatting', { 
                userId, 
                error: markdownError.message,
                contentLength: messageContent.length 
              });
              // Send without markdown formatting
              await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                caption: messageContent.replace(/[*_`\[\]()]/g, ''), // Remove all markdown characters
                ...inlineKeyboard
              });
            } else {
              throw markdownError;
            }
          }
        } catch (photoError) {
          logger.warn('Failed to send photo, sending text only', { 
            userId, 
            imagePath,
            error: photoError as Error
          });
          
          // Fallback to text only
          try {
            await this.bot.telegram.sendMessage(userId, messageContent, {
              parse_mode: 'Markdown',
              link_preview_options: { is_disabled: true },
              ...inlineKeyboard
            });
          } catch (markdownError: any) {
            if (markdownError.message?.includes('parse entities')) {
              logger.warn('Markdown parsing failed in text fallback, sending without formatting', { 
                userId, 
                error: markdownError.message 
              });
              await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
                link_preview_options: { is_disabled: true },
                ...inlineKeyboard
              });
            } else {
              throw markdownError;
            }
          }
        }
      } else {
        // Send text only
        try {
          await this.bot.telegram.sendMessage(userId, messageContent, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true },
            ...inlineKeyboard
          });
        } catch (markdownError: any) {
          if (markdownError.message?.includes('parse entities')) {
            logger.warn('Markdown parsing failed in main text send, sending without formatting', { 
              userId, 
              error: markdownError.message 
            });
            await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
              link_preview_options: { is_disabled: true },
              ...inlineKeyboard
            });
          } else {
            throw markdownError;
          }
        }
      }

      cache.cacheWelcomeMessageSent(userId);
      // Also cache the welcome timestamp for TikTok verification timing
      cache.set(`welcome_sent:${userId}`, Date.now(), 1800); // Valid for 30 minutes
      logger.logMessageSent(userId, 'welcome_tiktok', true);
      return true;
      
    } catch (error) {
      logger.logMessageSent(userId, 'welcome_tiktok', false, error as Error);
      return false;
    }
  }

  async sendWelcomeReturningUser(
    userId: number, 
    userName: string,
    totalPoints: number,
    referralLink?: string
  ): Promise<boolean> {
    // Check if welcome message was already sent
    if (cache.isWelcomeMessageSent(userId)) {
      logger.debug('Welcome message already sent to returning user', { userId, userName });
      return true;
    }

    // Rate limiting check
    if (!cache.checkRateLimit(`welcome:${userId}`, 1, 300)) {
      logger.warn('Welcome message rate limit exceeded for returning user', { userId, userName });
      return false;
    }

    try {
      // Get welcome image from settings
      const welcomeImage = await messageService.getSetting('WELCOME_IMAGE', 'istruzioni.png');

      const variables: any = {
        userName,
        totalPoints,
        welcomeImage: welcomeImage
      };

      // Add referralLink only if provided
      if (referralLink) {
        variables.referralLink = referralLink;
      }

      // Get message metadata with processed variables
      const metadata = await messageService.getMessageMetadata('welcome_returning_user', variables);
      
      const messageContent = await messageService.loadMessage('welcome_returning_user', {
        variables
      });

      // Check if message has image metadata or fallback to settings
      const imagePath = metadata.IMAGE || welcomeImage;
      
      if (imagePath && imagePath.trim()) {
        try {
          // Send with photo
          const photoFilePath = join(process.cwd(), 'media', imagePath.trim());
          const photoBuffer = await readFile(photoFilePath);
          
          try {
            await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
              caption: messageContent,
              parse_mode: 'Markdown'
            });
          } catch (markdownError: any) {
            if (markdownError.message?.includes('parse entities')) {
              logger.warn('Markdown parsing failed in returning user photo message, sending without formatting', { 
                userId, 
                error: markdownError.message 
              });
              await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                caption: messageContent.replace(/[*_`\[\]()]/g, '')
              });
            } else {
              throw markdownError;
            }
          }
          
        } catch (photoError: any) {
          logger.warn('Failed to send photo in returning user message, sending text only', { 
            userId, 
            imagePath,
            error: photoError.message 
          });
          
          // Send text-only message if photo fails
          try {
            await this.bot.telegram.sendMessage(userId, messageContent, {
              parse_mode: 'Markdown',
              link_preview_options: { is_disabled: true }
            });
          } catch (markdownError: any) {
            if (markdownError.message?.includes('parse entities')) {
              logger.warn('Markdown parsing failed in returning user text fallback, sending without formatting', { 
                userId, 
                error: markdownError.message 
              });
              await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
                link_preview_options: { is_disabled: true }
              });
            } else {
              throw markdownError;
            }
          }
        }
      } else {
        // Send text-only message if no image
        try {
          await this.bot.telegram.sendMessage(userId, messageContent, {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
          });
        } catch (markdownError: any) {
          if (markdownError.message?.includes('parse entities')) {
            logger.warn('Markdown parsing failed in returning user main text send, sending without formatting', { 
              userId, 
              error: markdownError.message 
            });
            await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
              link_preview_options: { is_disabled: true }
            });
          } else {
            throw markdownError;
          }
        }
      }

      cache.cacheWelcomeMessageSent(userId);
      logger.logMessageSent(userId, 'welcome_returning_user', true);
      return true;
      
    } catch (error) {
      logger.logMessageSent(userId, 'welcome_returning_user', false, error as Error);
      return false;
    }
  }

  async sendTikTokPointsMessage(
    userId: number, 
    userName: string, 
    totalPoints: number,
    referralLink: string
  ): Promise<boolean> {
    // Rate limiting check
    if (!cache.checkRateLimit(`tiktok_points:${userId}`, 1, 60)) { // 1 message per minute
      logger.warn('TikTok points message rate limit exceeded', { userId, userName });
      return false;
    }

    try {
      const messageContent = await messageService.loadMessage('tiktok_points_earned', {
        variables: {
          userName,
          totalPoints,
          referralLink
        }
      });

      await this.bot.telegram.sendMessage(userId, messageContent, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true }
      });

      logger.logMessageSent(userId, 'tiktok_points', true);
      return true;
      
    } catch (error) {
      logger.logMessageSent(userId, 'tiktok_points', false, error as Error);
      return false;
    }
  }

  async sendGoodbyeMessage(
    userId: number, 
    userName: string, 
    options: GoodbyeMessageOptions = {}
  ): Promise<boolean> {
    // Check if goodbye message was already sent recently
    if (cache.isGoodbyeMessageSent(userId)) {
      logger.debug('Goodbye message already sent to user recently', { userId, userName });
      return true;
    }

    // Rate limiting check
    if (!cache.checkRateLimit(`goodbye:${userId}`, 1, 300)) { // 1 message per 5 minutes
      logger.warn('Goodbye message rate limit exceeded', { userId, userName });
      return false;
    }

    try {
      const goodbyeMessage = await this.getGoodbyeMessage(userName, options);

      await this.bot.telegram.sendMessage(userId, goodbyeMessage, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true }
      });

      cache.cacheGoodbyeMessageSent(userId);
      logger.logMessageSent(userId, 'goodbye', true);
      return true;
      
    } catch (error) {
      logger.logMessageSent(userId, 'goodbye', false, error as Error);
      return false;
    }
  }

  async approveChatJoinRequest(chatId: number, userId: number): Promise<boolean> {
    try {
      await this.bot.telegram.approveChatJoinRequest(chatId, userId);
      logger.debug('Chat join request approved', { chatId, userId });
      return true;
      
    } catch (error) {
      logger.error('Failed to approve chat join request', error as Error, { chatId, userId });
      return false;
    }
  }

  async declineChatJoinRequest(chatId: number, userId: number): Promise<boolean> {
    try {
      await this.bot.telegram.declineChatJoinRequest(chatId, userId);
      logger.debug('Chat join request declined', { chatId, userId });
      return true;
      
    } catch (error) {
      logger.error('Failed to decline chat join request', error as Error, { chatId, userId });
      return false;
    }
  }

  async getChatMemberCount(chatId: number): Promise<number | null> {
    try {
      const count = await this.bot.telegram.getChatMembersCount(chatId);
      return count;
    } catch (error) {
      logger.error('Failed to get chat member count', error as Error, { chatId });
      return null;
    }
  }

  async getChatInfo(chatId: number): Promise<any> {
    try {
      const chat = await this.bot.telegram.getChat(chatId);
      return chat;
    } catch (error) {
      logger.error('Failed to get chat info', error as Error, { chatId });
      return null;
    }
  }

  async createChannelInviteLink(chatId: number, referralCode: string): Promise<string | null> {
    try {
      // Create a unique invite link with the referral code as name for tracking
      const inviteLink = await this.bot.telegram.createChatInviteLink(chatId, {
        name: `Referral: ${referralCode}`,
        creates_join_request: true, // This ensures users still need approval
        expire_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days expiry
      });
      
      logger.info('Channel invite link created successfully', {
        chatId,
        referralCode,
        inviteLink: inviteLink.invite_link,
        expiresAt: inviteLink.expire_date
      });
      
      return inviteLink.invite_link;
    } catch (error) {
      logger.error('Failed to create channel invite link', error as Error, { 
        chatId, 
        referralCode 
      });
      return null;
    }
  }

  async getReferralInviteLink(referralCode: string): Promise<string | null> {
    const chatId = parseInt(config.channelId);
    
    // Check if we already have a cached invite link for this referral code
    const cacheKey = `invite_link:${referralCode}`;
    const cachedLink = cache.get(cacheKey) as string;
    
    if (cachedLink) {
      logger.debug('Using cached invite link', { referralCode, link: cachedLink });
      return cachedLink;
    }
    
    // Create new invite link using the referral code directly
    const inviteLink = await this.createChannelInviteLink(chatId, referralCode);
    
    if (inviteLink) {
      // Cache for 24 hours since links expire in 30 days
      cache.set(cacheKey, inviteLink, 24 * 60 * 60);
      logger.info('New invite link cached', { referralCode, link: inviteLink });
    }
    
    return inviteLink;
  }

  private async getGoodbyeMessage(userName: string, options: GoodbyeMessageOptions): Promise<string> {
    const variables = {
      userName,
      customMessage: options.customMessage || '',
      includeReturnMessage: options.includeReturnMessage || false
    };

    return await messageService.loadMessage('goodbye', { variables });
  }

  async sendPhoto(chatId: number, photoPath: string, caption?: string): Promise<boolean> {
    try {
      const photoBuffer = await readFile(photoPath);
      
      const options: any = {};
      if (caption) {
        options.caption = caption;
        options.parse_mode = 'Markdown';
      }
      
      await this.bot.telegram.sendPhoto(chatId, { source: photoBuffer }, options);
      
      logger.info('Photo sent successfully', { chatId, photoPath, hasCaption: !!caption });
      return true;
      
    } catch (error) {
      logger.error('Failed to send photo', error as Error, { chatId, photoPath });
      return false;
    }
  }

  getBot(): Telegraf {
    return this.bot;
  }

  async startPolling(): Promise<void> {
    const allowedUpdates: Array<'chat_join_request' | 'message' | 'chat_member' | 'my_chat_member' | 'callback_query'> = [
      'chat_join_request',
      'message',
      'chat_member',
      'my_chat_member',
      'callback_query'
    ];

    try {
      await this.bot.launch({
        allowedUpdates
      });

      logger.info('Telegram bot started successfully', {
        allowedUpdates,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to start Telegram bot', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.bot.stop();
      logger.info('Telegram bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping Telegram bot', error as Error);
      throw error;
    }
  }
}