import { Context } from 'telegraf';
import logger from '../utils/logger';

/**
 * Handles bot status monitoring and chat membership changes
 * Tracks when the bot is added/removed from channels and its permission changes
 */
export class BotStatusHandler {
  constructor() {}

  /**
   * Handle changes to the bot's membership status in chats
   * This event fires when the bot is added/removed/promoted/demoted in chats
   */
  async handleMyChatMember(ctx: Context): Promise<void> {
    if (!('my_chat_member' in ctx.update)) {
      logger.warn('Invalid my_chat_member update', { update: ctx.update });
      return;
    }

    const memberUpdate = ctx.update.my_chat_member;
    const chatId = memberUpdate.chat.id;
    const oldStatus = memberUpdate.old_chat_member.status;
    const newStatus = memberUpdate.new_chat_member.status;
    const botUser = memberUpdate.new_chat_member.user;
    const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';

    logger.info('Bot status change in chat', {
      botId: botUser.id,
      botUsername: botUser.username,
      chatId,
      chatTitle,
      oldStatus,
      newStatus,
      from: memberUpdate.from
    });

    try {
      // Process different status changes
      await this.processBotStatusChange(memberUpdate, oldStatus, newStatus, chatId, chatTitle);
      
    } catch (error) {
      logger.error('Error processing bot status change', error as Error, {
        chatId,
        chatTitle,
        oldStatus,
        newStatus,
        botId: botUser.id
      });
    }
  }

  /**
   * Process different types of bot status changes
   */
  private async processBotStatusChange(
    memberUpdate: any, 
    oldStatus: string, 
    newStatus: string, 
    chatId: number, 
    chatTitle: string
  ): Promise<void> {
    
    if (this.isBotPromotedToAdmin(oldStatus, newStatus)) {
      await this.handleBotPromotedToAdmin(memberUpdate, chatId, chatTitle);
    } 
    else if (this.isBotRemovedFromChat(newStatus)) {
      await this.handleBotRemovedFromChat(memberUpdate, chatId, chatTitle, newStatus);
    }
    else if (this.isBotAddedToChat(oldStatus, newStatus)) {
      await this.handleBotAddedToChat(memberUpdate, chatId, chatTitle);
    }
    else if (this.isBotDemoted(oldStatus, newStatus)) {
      await this.handleBotDemoted(memberUpdate, chatId, chatTitle);
    }
    else {
      // Log other status changes for monitoring
      logger.debug('Other bot status change', {
        chatId,
        chatTitle,
        oldStatus,
        newStatus,
        change: `${oldStatus} -> ${newStatus}`
      });
    }
  }

  /**
   * Handle bot promotion to administrator
   */
  private async handleBotPromotedToAdmin(memberUpdate: any, chatId: number, chatTitle: string): Promise<void> {
    logger.info('Bot promoted to administrator', { 
      chatId, 
      chatTitle,
      promotedBy: memberUpdate.from?.first_name || 'Unknown'
    });

    // Check what permissions the bot has been granted
    const adminRights = memberUpdate.new_chat_member.can_invite_users || 
                       memberUpdate.new_chat_member.can_manage_chat ||
                       memberUpdate.new_chat_member.can_delete_messages;

    if (adminRights) {
      logger.info('Bot granted admin permissions', {
        chatId,
        chatTitle,
        permissions: {
          can_invite_users: memberUpdate.new_chat_member.can_invite_users,
          can_manage_chat: memberUpdate.new_chat_member.can_manage_chat,
          can_delete_messages: memberUpdate.new_chat_member.can_delete_messages,
          can_restrict_members: memberUpdate.new_chat_member.can_restrict_members
        }
      });
    }
  }

  /**
   * Handle bot removal from chat
   */
  private async handleBotRemovedFromChat(memberUpdate: any, chatId: number, chatTitle: string, newStatus: string): Promise<void> {
    logger.warn('Bot removed from chat', { 
      chatId, 
      chatTitle, 
      newStatus,
      removedBy: memberUpdate.from?.first_name || 'Unknown'
    });

    // Log the reason for removal if available
    const removalReason = newStatus === 'kicked' ? 'kicked by admin' : 'left the chat';
    
    logger.warn('Bot access lost', {
      chatId,
      chatTitle,
      reason: removalReason,
      timestamp: new Date().toISOString()
    });

    // This is important for monitoring - the bot can no longer operate in this chat
    // Could trigger alerts if this is the main channel
  }

  /**
   * Handle bot being added back to chat
   */
  private async handleBotAddedToChat(memberUpdate: any, chatId: number, chatTitle: string): Promise<void> {
    logger.info('Bot added back to chat', { 
      chatId, 
      chatTitle,
      addedBy: memberUpdate.from?.first_name || 'Unknown'
    });

    // Check if bot has necessary permissions
    const hasBasicPermissions = memberUpdate.new_chat_member.status === 'administrator' ||
                               memberUpdate.new_chat_member.status === 'member';

    if (!hasBasicPermissions) {
      logger.warn('Bot added but with restricted permissions', {
        chatId,
        chatTitle,
        status: memberUpdate.new_chat_member.status
      });
    }
  }

  /**
   * Handle bot demotion from administrator
   */
  private async handleBotDemoted(memberUpdate: any, chatId: number, chatTitle: string): Promise<void> {
    logger.warn('Bot demoted from administrator', { 
      chatId, 
      chatTitle,
      demotedBy: memberUpdate.from?.first_name || 'Unknown'
    });

    // This might affect bot functionality if admin rights were required
    logger.warn('Bot admin privileges revoked', {
      chatId,
      chatTitle,
      newStatus: memberUpdate.new_chat_member.status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if bot was promoted to admin
   */
  private isBotPromotedToAdmin(oldStatus: string, newStatus: string): boolean {
    return newStatus === 'administrator' && oldStatus !== 'administrator';
  }

  /**
   * Check if bot was removed from chat
   */
  private isBotRemovedFromChat(newStatus: string): boolean {
    return newStatus === 'left' || newStatus === 'kicked';
  }

  /**
   * Check if bot was added to chat
   */
  private isBotAddedToChat(oldStatus: string, newStatus: string): boolean {
    const wasRemoved = oldStatus === 'left' || oldStatus === 'kicked';
    const isNowActive = newStatus === 'member' || newStatus === 'administrator';
    return wasRemoved && isNowActive;
  }

  /**
   * Check if bot was demoted
   */
  private isBotDemoted(oldStatus: string, newStatus: string): boolean {
    return oldStatus === 'administrator' && newStatus === 'member';
  }

  /**
   * Get current bot status in chat (utility method)
   */
  async getBotStatus(ctx: Context, chatId: number): Promise<string | null> {
    try {
      const botInfo = await ctx.telegram.getMe();
      const chatMember = await ctx.telegram.getChatMember(chatId, botInfo.id);
      return chatMember.status;
    } catch (error) {
      logger.error('Failed to get bot status', error as Error, { chatId });
      return null;
    }
  }

  /**
   * Check if bot has admin permissions in chat (utility method)
   */
  async hasBotAdminPermissions(ctx: Context, chatId: number): Promise<boolean> {
    try {
      const botInfo = await ctx.telegram.getMe();
      const chatMember = await ctx.telegram.getChatMember(chatId, botInfo.id);
      
      return chatMember.status === 'administrator' || chatMember.status === 'creator';
    } catch (error) {
      logger.error('Failed to check bot admin permissions', error as Error, { chatId });
      return false;
    }
  }
}