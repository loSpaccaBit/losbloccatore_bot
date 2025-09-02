import { TelegramCoreService } from './TelegramCoreService';
import logger from '../../utils/logger';

/**
 * Telegram Chat Service
 * Handles chat management operations, member management, and join requests
 */
export class TelegramChatService {
  private coreService: TelegramCoreService;

  constructor(coreService: TelegramCoreService) {
    this.coreService = coreService;
    logger.info('TelegramChatService initialized');
  }

  /**
   * Approve a chat join request
   */
  async approveChatJoinRequest(chatId: number, userId: number): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      await bot.telegram.approveChatJoinRequest(chatId, userId);
      
      logger.info('Join request approved successfully', {
        chatId,
        userId
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to approve chat join request', error as Error, {
        chatId,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }

  /**
   * Decline a chat join request
   */
  async declineChatJoinRequest(chatId: number, userId: number): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      await bot.telegram.declineChatJoinRequest(chatId, userId);
      
      logger.info('Join request declined successfully', {
        chatId,
        userId
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to decline chat join request', error as Error, {
        chatId,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }

  /**
   * Get chat member count
   */
  async getChatMemberCount(chatId: number): Promise<number> {
    try {
      const bot = this.coreService.getBot();
      const memberCount = await bot.telegram.getChatMembersCount(chatId);
      
      logger.debug('Retrieved chat member count', {
        chatId,
        memberCount
      });
      
      return memberCount;
    } catch (error) {
      logger.error('Failed to get chat member count', error as Error, {
        chatId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return 0;
    }
  }

  /**
   * Get chat information
   */
  async getChatInfo(chatId: number): Promise<any | null> {
    try {
      const bot = this.coreService.getBot();
      const chatInfo = await bot.telegram.getChat(chatId);
      
      logger.debug('Retrieved chat info', {
        chatId,
        chatTitle: 'title' in chatInfo ? chatInfo.title : 'No title',
        chatType: chatInfo.type
      });
      
      return chatInfo;
    } catch (error) {
      logger.error('Failed to get chat info', error as Error, {
        chatId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  }

  /**
   * Get chat member information
   */
  async getChatMember(chatId: number, userId: number): Promise<any | null> {
    try {
      const bot = this.coreService.getBot();
      const member = await bot.telegram.getChatMember(chatId, userId);
      
      logger.debug('Retrieved chat member info', {
        chatId,
        userId,
        status: member.status
      });
      
      return member;
    } catch (error) {
      logger.error('Failed to get chat member', error as Error, {
        chatId,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  }

  /**
   * Check if user is member of chat
   */
  async isUserMemberOfChat(chatId: number, userId: number): Promise<boolean> {
    try {
      const member = await this.getChatMember(chatId, userId);
      
      if (!member) {
        return false;
      }
      
      // Consider user as member if they have any active status
      const activeMemberStatuses = ['member', 'administrator', 'creator'];
      return activeMemberStatuses.includes(member.status);
      
    } catch (error) {
      logger.error('Failed to check user membership', error as Error, {
        chatId,
        userId
      });
      
      return false;
    }
  }

  /**
   * Get chat administrators
   */
  async getChatAdministrators(chatId: number): Promise<any[]> {
    try {
      const bot = this.coreService.getBot();
      const administrators = await bot.telegram.getChatAdministrators(chatId);
      
      logger.debug('Retrieved chat administrators', {
        chatId,
        adminCount: administrators.length
      });
      
      return administrators;
    } catch (error) {
      logger.error('Failed to get chat administrators', error as Error, {
        chatId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return [];
    }
  }

  /**
   * Check if user is administrator of chat
   */
  async isUserAdminOfChat(chatId: number, userId: number): Promise<boolean> {
    try {
      const member = await this.getChatMember(chatId, userId);
      
      if (!member) {
        return false;
      }
      
      const adminStatuses = ['administrator', 'creator'];
      return adminStatuses.includes(member.status);
      
    } catch (error) {
      logger.error('Failed to check user admin status', error as Error, {
        chatId,
        userId
      });
      
      return false;
    }
  }

  /**
   * Ban chat member
   */
  async banChatMember(chatId: number, userId: number, untilDate?: number): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      await bot.telegram.banChatMember(chatId, userId, untilDate);
      
      logger.info('Chat member banned successfully', {
        chatId,
        userId,
        untilDate
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to ban chat member', error as Error, {
        chatId,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }

  /**
   * Unban chat member
   */
  async unbanChatMember(chatId: number, userId: number): Promise<boolean> {
    try {
      const bot = this.coreService.getBot();
      await bot.telegram.unbanChatMember(chatId, userId);
      
      logger.info('Chat member unbanned successfully', {
        chatId,
        userId
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to unban chat member', error as Error, {
        chatId,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }
}