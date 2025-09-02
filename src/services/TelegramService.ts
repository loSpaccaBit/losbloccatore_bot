import { Telegraf } from 'telegraf';
import { TelegramCoreService } from '../domains/telegram/TelegramCoreService';
import { TelegramMessageService } from '../domains/telegram/TelegramMessageService';
import { TelegramChatService } from '../domains/telegram/TelegramChatService';
import { TelegramInviteService } from '../domains/telegram/TelegramInviteService';
import { GoodbyeMessageOptions } from '../types';
import logger from '../utils/logger';

/**
 * Refactored Telegram Service - Composition of specialized services
 * Acts as a facade over the domain-specific Telegram services
 * Maintains backward compatibility while providing better separation of concerns
 */
export class TelegramService {
  private coreService: TelegramCoreService;
  private messageService: TelegramMessageService;
  private chatService: TelegramChatService;
  private inviteService: TelegramInviteService;

  constructor() {
    // Initialize core service first
    this.coreService = new TelegramCoreService();
    
    // Initialize other services with core service dependency
    this.messageService = new TelegramMessageService(this.coreService);
    this.chatService = new TelegramChatService(this.coreService);
    this.inviteService = new TelegramInviteService(this.coreService);
    
    logger.info('TelegramService initialized with all domain services');
  }

  // ==================== CORE SERVICE METHODS ====================
  
  /**
   * Get the Telegraf bot instance
   */
  getBot(): Telegraf {
    return this.coreService.getBot();
  }

  /**
   * Start bot polling
   */
  async startPolling(): Promise<void> {
    return this.coreService.startPolling();
  }

  /**
   * Stop bot polling
   */
  async stop(): Promise<void> {
    return this.coreService.stop();
  }

  /**
   * Check if bot is currently polling
   */
  isCurrentlyPolling(): boolean {
    return this.coreService.isCurrentlyPolling();
  }

  /**
   * Get bot information
   */
  async getBotInfo(): Promise<any> {
    return this.coreService.getBotInfo();
  }

  // ==================== MESSAGE SERVICE METHODS ====================

  /**
   * Process text for safe Markdown parsing
   */
  processMarkdownText(text: string): string {
    return this.messageService.processMarkdownText(text);
  }

  /**
   * Send welcome message with TikTok integration
   */
  async sendWelcomeWithTikTok(userId: number, userName: string, referralLink: string): Promise<boolean> {
    return this.messageService.sendWelcomeWithTikTok(userId, userName, referralLink);
  }

  /**
   * Send welcome message for returning users
   */
  async sendWelcomeReturningUser(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean> {
    return this.messageService.sendWelcomeReturningUser(userId, userName, totalPoints, referralLink);
  }

  /**
   * Send TikTok points success message
   */
  async sendTikTokPointsMessage(userId: number, userName: string, totalPoints: number, referralLink: string): Promise<boolean> {
    return this.messageService.sendTikTokPointsMessage(userId, userName, totalPoints, referralLink);
  }

  /**
   * Send goodbye message
   */
  async sendGoodbyeMessage(userId: number, userName: string, options?: GoodbyeMessageOptions): Promise<boolean> {
    return this.messageService.sendGoodbyeMessage(userId, userName, options);
  }

  /**
   * Send photo message
   */
  async sendPhoto(chatId: number, photoPath: string, caption?: string, options?: any): Promise<boolean> {
    return this.messageService.sendPhoto(chatId, photoPath, caption, options);
  }

  // ==================== CHAT SERVICE METHODS ====================

  /**
   * Approve chat join request
   */
  async approveChatJoinRequest(chatId: number, userId: number): Promise<boolean> {
    return this.chatService.approveChatJoinRequest(chatId, userId);
  }

  /**
   * Decline chat join request
   */
  async declineChatJoinRequest(chatId: number, userId: number): Promise<boolean> {
    return this.chatService.declineChatJoinRequest(chatId, userId);
  }

  /**
   * Get chat member count
   */
  async getChatMemberCount(chatId: number): Promise<number> {
    return this.chatService.getChatMemberCount(chatId);
  }

  /**
   * Get chat information
   */
  async getChatInfo(chatId: number): Promise<any | null> {
    return this.chatService.getChatInfo(chatId);
  }

  /**
   * Get chat member information
   */
  async getChatMember(chatId: number, userId: number): Promise<any | null> {
    return this.chatService.getChatMember(chatId, userId);
  }

  /**
   * Check if user is member of chat
   */
  async isUserMemberOfChat(chatId: number, userId: number): Promise<boolean> {
    return this.chatService.isUserMemberOfChat(chatId, userId);
  }

  /**
   * Check if user is administrator of chat
   */
  async isUserAdminOfChat(chatId: number, userId: number): Promise<boolean> {
    return this.chatService.isUserAdminOfChat(chatId, userId);
  }

  // ==================== INVITE SERVICE METHODS ====================

  /**
   * Create channel invite link
   */
  async createChannelInviteLink(chatId: number, name?: string, expireDate?: number, memberLimit?: number): Promise<string | null> {
    return this.inviteService.createChannelInviteLink(chatId, name, expireDate, memberLimit);
  }

  /**
   * Get referral invite link
   */
  async getReferralInviteLink(referralCode: string): Promise<string | null> {
    return this.inviteService.getReferralInviteLink(referralCode);
  }

  /**
   * Revoke invite link
   */
  async revokeInviteLink(chatId: number, inviteLink: string): Promise<boolean> {
    return this.inviteService.revokeInviteLink(chatId, inviteLink);
  }

  /**
   * Export primary chat invite link
   */
  async exportChatInviteLink(chatId: number): Promise<string | null> {
    return this.inviteService.exportChatInviteLink(chatId);
  }

  // ==================== SERVICE ACCESS METHODS ====================

  /**
   * Get core service instance (for advanced use cases)
   */
  getCoreService(): TelegramCoreService {
    return this.coreService;
  }

  /**
   * Get message service instance (for advanced use cases)
   */
  getMessageService(): TelegramMessageService {
    return this.messageService;
  }

  /**
   * Get chat service instance (for advanced use cases)
   */
  getChatService(): TelegramChatService {
    return this.chatService;
  }

  /**
   * Get invite service instance (for advanced use cases)
   */
  getInviteService(): TelegramInviteService {
    return this.inviteService;
  }

  // ==================== HEALTH CHECK & MONITORING ====================

  /**
   * Health check for all Telegram services
   */
  async healthCheck(): Promise<{
    overall: boolean;
    core: boolean;
    details: any;
  }> {
    try {
      const coreHealthy = await this.coreService.healthCheck();
      
      return {
        overall: coreHealthy,
        core: coreHealthy,
        details: {
          isPolling: this.coreService.isCurrentlyPolling(),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Telegram service health check failed', error as Error);
      
      return {
        overall: false,
        core: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    isPolling: boolean;
    referralLinkStats: any;
    timestamp: string;
  } {
    return {
      isPolling: this.coreService.isCurrentlyPolling(),
      referralLinkStats: this.inviteService.getReferralLinkStats(),
      timestamp: new Date().toISOString()
    };
  }
}