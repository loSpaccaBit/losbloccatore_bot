import { TelegramCoreService } from './TelegramCoreService';
import cache from '../../utils/cache';
import config from '../../config';
import logger from '../../utils/logger';

/**
 * Telegram Invite Service
 * Handles invite link creation, management, and caching
 */
export class TelegramInviteService {
  private coreService: TelegramCoreService;

  constructor(coreService: TelegramCoreService) {
    this.coreService = coreService;
    logger.info('TelegramInviteService initialized');
  }

  /**
   * Create a channel invite link with custom name
   */
  async createChannelInviteLink(chatId: number, name?: string, expireDate?: number, memberLimit?: number): Promise<string | null> {
    try {
      const bot = this.coreService.getBot();
      
      const linkOptions: any = {};
      if (name) linkOptions.name = name;
      if (expireDate) linkOptions.expire_date = expireDate;
      if (memberLimit) linkOptions.member_limit = memberLimit;

      const inviteLink = await bot.telegram.createChatInviteLink(chatId, linkOptions);
      
      logger.info('Channel invite link created successfully', {
        chatId,
        name,
        expireDate,
        memberLimit,
        inviteLink: inviteLink.invite_link
      });
      
      return inviteLink.invite_link;
    } catch (error) {
      logger.error('Failed to create channel invite link', error as Error, {
        chatId,
        name,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  }

  /**
   * Get or create referral invite link for user
   * Uses caching to avoid creating duplicate links
   */
  async getReferralInviteLink(referralCode: string): Promise<string | null> {
    try {
      // Check cache first
      const cacheKey = `referral_link:${referralCode}`;
      const cachedLink = cache.get(cacheKey) as string;
      
      if (cachedLink) {
        logger.debug('Using cached referral link', { referralCode });
        return cachedLink;
      }

      // Create new invite link
      const chatId = parseInt(config.channelId);
      const linkName = `Referral: ${referralCode}`;
      
      // Create link with 1 month expiry
      const expireDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
      
      const inviteLink = await this.createChannelInviteLink(chatId, linkName, expireDate);
      
      if (inviteLink) {
        // Cache the link for 25 days (before it expires)
        cache.setWithTTL(cacheKey, inviteLink, 25 * 24 * 60 * 60);
        
        logger.info('Referral invite link created and cached', {
          referralCode,
          inviteLink,
          expireDate: new Date(expireDate * 1000).toISOString()
        });
        
        return inviteLink;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get referral invite link', error as Error, {
        referralCode,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  }

  /**
   * Revoke an invite link
   */
  async revokeInviteLink(chatId: number, inviteLink: string): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      await bot.telegram.revokeChatInviteLink(chatId, inviteLink);
      
      logger.info('Invite link revoked successfully', {
        chatId,
        inviteLink
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to revoke invite link', error as Error, {
        chatId,
        inviteLink,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }

  /**
   * Get all invite links for a chat
   */
  async getChatInviteLinks(chatId: number): Promise<any[]> {
    try {
      const bot = this.coreService.getBot();
      const botInfo = await bot.telegram.getMe();
      
      // Get chat info (simplified implementation)
      await bot.telegram.getChat(chatId);
      
      logger.debug('Retrieved chat invite links', {
        chatId,
        botId: botInfo.id
      });
      
      // Note: This is a simplified version
      // The actual implementation might need to use exportChatInviteLink or other methods
      return [];
    } catch (error) {
      logger.error('Failed to get chat invite links', error as Error, {
        chatId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return [];
    }
  }

  /**
   * Export primary chat invite link
   */
  async exportChatInviteLink(chatId: number): Promise<string | null> {
    try {
      const bot = this.coreService.getBot();
      const inviteLink = await bot.telegram.exportChatInviteLink(chatId);
      
      logger.info('Primary chat invite link exported', {
        chatId,
        inviteLink
      });
      
      return inviteLink;
    } catch (error) {
      logger.error('Failed to export chat invite link', error as Error, {
        chatId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  }

  /**
   * Clean up expired cached referral links
   */
  async cleanupExpiredReferralLinks(): Promise<number> {
    try {
      let cleanedCount = 0;
      
      // Get all referral link cache keys
      // Note: This is a simplified implementation
      // A more sophisticated cache implementation would provide pattern-based cleanup
      
      logger.info('Referral link cache cleanup completed', {
        cleanedCount
      });
      
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired referral links', error as Error);
      return 0;
    }
  }

  /**
   * Get cached referral link without creating new one
   */
  getCachedReferralLink(referralCode: string): string | null {
    const cacheKey = `referral_link:${referralCode}`;
    return cache.get(cacheKey) as string || null;
  }

  /**
   * Clear cached referral link
   */
  clearCachedReferralLink(referralCode: string): void {
    const cacheKey = `referral_link:${referralCode}`;
    cache.del(cacheKey);
    
    logger.debug('Referral link cache cleared', { referralCode });
  }

  /**
   * Get referral link statistics
   */
  getReferralLinkStats(): { totalCached: number; cacheHitRate: number } {
    // This would need a more sophisticated cache implementation
    // to track statistics properly
    return {
      totalCached: 0,
      cacheHitRate: 0
    };
  }
}