import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
import { ChatMemberUpdate } from '../types';
import config from '../config';
import logger from '../utils/logger';

/**
 * Handles chat member lifecycle events (joins via member updates, leaves, status changes)
 * Separated from join request logic for better maintainability
 */
export class MemberLifecycleHandler {
  constructor(
    private telegramService: TelegramService,
    private userActivityService: UserActivityService,
    private contestService: ContestService
  ) {}

  /**
   * Handle chat member updates (status changes, joins, leaves)
   */
  async handleChatMemberUpdate(ctx: Context): Promise<void> {
    if (!('chat_member' in ctx.update)) {
      logger.warn('Invalid chat member update', { update: ctx.update });
      return;
    }

    const memberUpdate = ctx.update.chat_member;
    const chatId = memberUpdate.chat.id;
    const oldStatus = memberUpdate.old_chat_member.status;
    const newStatus = memberUpdate.new_chat_member.status;
    const user = memberUpdate.new_chat_member.user;
    const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';

    logger.debug('Chat member status change', {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      chatId,
      chatTitle,
      oldStatus,
      newStatus,
      isBot: user.is_bot
    });

    try {
      // Skip bot member updates
      if (user.is_bot) {
        logger.debug('Skipping bot member update', {
          botId: user.id,
          botUsername: user.username,
          chatId,
          oldStatus,
          newStatus
        });
        return;
      }

      // Only process authorized channel events
      if (!this.isAuthorizedChannel(chatId)) {
        logger.debug('Member update ignored - unauthorized channel', {
          chatId,
          authorizedChatId: config.channelId
        });
        return;
      }

      // Process member status changes
      await this.processMemberStatusChange(memberUpdate);

    } catch (error) {
      logger.error('Error processing chat member update', error as Error, {
        userId: user.id,
        username: user.username,
        chatId,
        oldStatus,
        newStatus
      });
    }
  }

  /**
   * Handle left chat member events (legacy event for small groups)
   */
  async handleLeftChatMember(ctx: Context): Promise<void> {
    if (!('message' in ctx.update) || !('left_chat_member' in ctx.update.message)) {
      logger.warn('Invalid left chat member update', { update: ctx.update });
      return;
    }

    const message = ctx.update.message;
    const leftUser = (message as any).left_chat_member;
    const chatId = message.chat.id;
    const chatTitle = 'title' in message.chat ? message.chat.title : 'Unknown Chat';

    logger.logUserLeft(leftUser.id, leftUser.first_name, chatId, chatTitle);

    try {
      // Only process authorized channel events
      if (!this.isAuthorizedChannel(chatId)) {
        logger.debug('Left member event ignored - unauthorized channel', {
          chatId,
          authorizedChatId: config.channelId
        });
        return;
      }

      await this.processLegacyUserLeave(message, leftUser, chatId, chatTitle);

    } catch (error) {
      logger.error('Error processing left chat member', error as Error, {
        userId: leftUser.id,
        username: leftUser.username,
        chatId
      });
    }
  }

  /**
   * Process member status changes (join, leave, promotion, etc.)
   */
  private async processMemberStatusChange(memberUpdate: any): Promise<void> {
    const oldStatus = memberUpdate.old_chat_member.status;
    const newStatus = memberUpdate.new_chat_member.status;
    const user = memberUpdate.new_chat_member.user;
    const chatId = memberUpdate.chat.id;

    // Enhanced logging for debugging
    logger.info('Processing member status change', {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      chatId,
      oldStatus,
      newStatus,
      statusTransition: `${oldStatus} -> ${newStatus}`
    });

    const memberStatuses = ['member', 'administrator', 'creator'];
    const leftStatuses = ['left', 'kicked', 'banned'];

    const wasActive = memberStatuses.includes(oldStatus);
    const isActive = memberStatuses.includes(newStatus);
    const isLeft = leftStatuses.includes(newStatus);

    logger.debug('Status analysis', {
      userId: user.id,
      wasActive,
      isActive,
      isLeft,
      memberStatuses,
      leftStatuses
    });

    if (wasActive && isLeft) {
      logger.info('User is leaving the channel - triggering goodbye flow', {
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        chatId,
        oldStatus,
        newStatus
      });
      // User left the channel
      await this.handleUserLeave(memberUpdate);
    } else if (!wasActive && isActive) {
      // User joined the channel (alternative to join request)
      await this.handleUserJoinViaMemberUpdate(memberUpdate);
    } else {
      // Other status changes (admin promotion, etc.)
      logger.debug('Other member status change', {
        userId: user.id,
        username: user.username,
        chatId,
        oldStatus,
        newStatus
      });
    }
  }

  /**
   * Handle user leaving the channel
   */
  private async handleUserLeave(memberUpdate: any): Promise<void> {
    const user = memberUpdate.new_chat_member.user;
    const chatId = memberUpdate.chat.id;
    const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';

    logger.logUserLeft(user.id, user.first_name, chatId, chatTitle);

    // Create standardized member update event
    const chatMemberUpdateEvent: ChatMemberUpdate = {
      chat: {
        id: memberUpdate.chat.id,
        title: chatTitle,
        type: memberUpdate.chat.type
      },
      from: memberUpdate.from,
      date: memberUpdate.date,
      old_chat_member: memberUpdate.old_chat_member,
      new_chat_member: memberUpdate.new_chat_member
    };

    // Record the leave event
    await this.userActivityService.recordUserLeave(chatMemberUpdateEvent);

    // Handle contest participant leaving (revoke referral points)
    await this.contestService.handleUserLeft(user.id, chatId);

    // Send goodbye message
    await this.sendGoodbyeMessage(user);
  }

  /**
   * Handle user joining via member update (admin added them directly)
   */
  private async handleUserJoinViaMemberUpdate(memberUpdate: any): Promise<void> {
    const user = memberUpdate.new_chat_member.user;
    const chatId = memberUpdate.chat.id;
    const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';

    logger.info('User joined channel via member update', {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      chatId,
      newStatus: memberUpdate.new_chat_member.status
    });

    // This might happen if user was added directly by admin
    // Record as approval since they're now a member
    await this.userActivityService.recordApproval(user.id, chatId, chatTitle, user);

    // Create contest participant
    await this.contestService.getOrCreateParticipant(
      user.id,
      chatId,
      user.first_name,
      user.last_name,
      user.username
    );
  }

  /**
   * Process legacy left_chat_member event (for small groups)
   */
  private async processLegacyUserLeave(message: any, leftUser: any, chatId: number, chatTitle: string): Promise<void> {
    // This event is more limited than chat_member update
    // It only works for small groups (<50 members) and may not always fire
    logger.info('User left via left_chat_member event', {
      userId: leftUser.id,
      username: leftUser.username,
      firstName: leftUser.first_name,
      chatId,
      note: 'This event works for small groups (<50 members)'
    });

    // Create a simplified member update event for recording
    const simplifiedMemberUpdate: ChatMemberUpdate = {
      chat: {
        id: chatId,
        title: chatTitle,
        type: message.chat.type
      },
      from: leftUser, // Using left user as the 'from' user
      date: message.date,
      old_chat_member: {
        user: leftUser,
        status: 'member'
      },
      new_chat_member: {
        user: leftUser,
        status: 'left'
      }
    };

    await this.userActivityService.recordUserLeave(simplifiedMemberUpdate);

    // Send goodbye message
    await this.sendGoodbyeMessage(leftUser);
  }

  /**
   * Send goodbye message to user who left
   */
  private async sendGoodbyeMessage(user: any): Promise<void> {
    logger.info('Attempting to send goodbye message', {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      step: 'before_telegram_service_call'
    });

    const goodbyeSent = await this.telegramService.sendGoodbyeMessage(
      user.id,
      user.first_name,
      {
        includeReturnMessage: true
      }
    );

    logger.info('Goodbye message attempt result', {
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      goodbyeSent,
      step: 'after_telegram_service_call'
    });

    if (!goodbyeSent) {
      logger.warn('Could not send goodbye message - detailed logging', {
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        reasons: [
          'User privacy settings prevent messages',
          'User blocked the bot',
          'User started bot but then blocked it',
          'Telegram API restrictions',
          'Network or service error'
        ]
      });
    } else {
      logger.info('Goodbye message sent successfully', {
        userId: user.id,
        username: user.username,
        firstName: user.first_name
      });
    }
  }

  /**
   * Check if the channel is authorized for processing
   */
  private isAuthorizedChannel(chatId: number): boolean {
    return chatId.toString() === config.channelId;
  }
}