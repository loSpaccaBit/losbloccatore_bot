import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
import { ChatJoinRequestEvent } from '../types';
import config from '../config';
import logger from '../utils/logger';

/**
 * Handles all chat join request logic following single responsibility principle
 */
export class JoinRequestHandler {
  constructor(
    private telegramService: TelegramService,
    private userActivityService: UserActivityService,
    private contestService: ContestService
  ) {}

  /**
   * Main handler for chat join requests
   */
  async handleChatJoinRequest(ctx: Context): Promise<void> {
    if (!('chat_join_request' in ctx.update)) {
      logger.warn('Invalid chat join request update', { update: ctx.update });
      return;
    }

    const joinRequest = ctx.update.chat_join_request;
    const userId = joinRequest.from.id;
    const userName = joinRequest.from.first_name;
    const chatId = joinRequest.chat.id;
    const chatTitle = 'title' in joinRequest.chat ? joinRequest.chat.title : 'Unknown';

    logger.logUserJoin(userId, userName, chatId, chatTitle);

    try {
      // Validate channel authorization
      if (!this.isAuthorizedChannel(chatId)) {
        logger.info('Join request ignored - unauthorized channel', {
          requestedChatId: chatId,
          authorizedChatId: config.channelId,
          userId,
          userName
        });
        return;
      }

      // Extract referral code from invite link if present
      const referralCode = await this.extractReferralCodeFromInviteLink(joinRequest.invite_link?.name);
      
      if (referralCode) {
        logger.info('Join request via referral invite link detected', {
          userId,
          userName,
          referralCode,
          inviteLinkName: joinRequest.invite_link?.name
        });
      }

      // Process the join request
      await this.processJoinRequest(joinRequest, referralCode, ctx);

    } catch (error) {
      await this.handleJoinRequestError(error, joinRequest, chatTitle);
    }
  }

  /**
   * Process the actual join request logic
   */
  private async processJoinRequest(joinRequest: any, referralCode: string | undefined, ctx: Context): Promise<void> {
    const userId = joinRequest.from.id;
    const userName = joinRequest.from.first_name;
    const chatId = joinRequest.chat.id;

    // Record the join request
    const joinRequestEvent: ChatJoinRequestEvent = {
      user: joinRequest.from,
      chat: joinRequest.chat,
      date: joinRequest.date
    };

    await this.userActivityService.recordJoinRequest(joinRequestEvent);

    // Check if user has joined before
    const hasJoinedBefore = await this.userActivityService.hasUserJoinedBefore(userId, chatId);

    if (hasJoinedBefore) {
      logger.info('User has joined before - auto-approving', {
        userId,
        userName,
        chatId
      });
    }

    // Approve the join request
    const approved = await this.telegramService.approveChatJoinRequest(chatId, userId);

    if (approved) {
      await this.handleSuccessfulApproval(joinRequest, referralCode, ctx);
    } else {
      await this.handleFailedApproval(joinRequest);
    }
  }

  /**
   * Handle successful join request approval
   */
  private async handleSuccessfulApproval(joinRequest: any, referralCode: string | undefined, ctx: Context): Promise<void> {
    const userId = joinRequest.from.id;
    const userName = joinRequest.from.first_name;
    const chatId = joinRequest.chat.id;
    const chatTitle = 'title' in joinRequest.chat ? joinRequest.chat.title : 'Unknown';

    logger.logUserApproved(userId, userName, chatId, chatTitle);

    // Record the approval
    await this.userActivityService.recordApproval(userId, chatId, chatTitle, joinRequest.from);

    // Create contest participant with referral
    await this.contestService.getOrCreateParticipant(
      userId,
      chatId,
      userName,
      joinRequest.from.last_name,
      joinRequest.from.username,
      referralCode
    );

    // Send appropriate welcome message
    await this.sendWelcomeMessage(userId, userName, chatId, ctx);
  }

  /**
   * Handle failed join request approval
   */
  private async handleFailedApproval(joinRequest: any): Promise<void> {
    const userId = joinRequest.from.id;
    const userName = joinRequest.from.first_name;
    const chatId = joinRequest.chat.id;
    const chatTitle = 'title' in joinRequest.chat ? joinRequest.chat.title : 'Unknown';

    logger.error('Failed to approve join request', undefined, {
      userId,
      userName,
      chatId,
      chatTitle
    });

    // Record the failure
    await this.userActivityService.recordRejection(
      userId,
      chatId,
      chatTitle,
      joinRequest.from,
      'Failed to approve via Telegram API'
    );
  }

  /**
   * Send appropriate welcome message based on user's TikTok task status
   */
  private async sendWelcomeMessage(userId: number, userName: string, chatId: number, ctx: Context): Promise<void> {
    // Get participant info and generate referral link
    const participantInfo = await this.contestService.getParticipantStats(userId, chatId);
    const userReferralCode = participantInfo?.referralCode || userId.toString();
    
    // Generate referral invite link
    const referralLink = await this.telegramService.getReferralInviteLink(userReferralCode);
    const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${userReferralCode}`;

    let welcomeSent = false;
    
    if (participantInfo?.tiktokTaskCompleted) {
      logger.info('User has already completed TikTok task - sending returning user welcome', {
        userId,
        userName,
        totalPoints: participantInfo.points
      });
      
      // Send welcome message for returning users (without TikTok buttons)
      welcomeSent = await this.telegramService.sendWelcomeReturningUser(
        userId,
        userName,
        participantInfo.points,
        finalReferralLink
      );
    } else {
      logger.info('User has not completed TikTok task - sending TikTok welcome with buttons', {
        userId,
        userName
      });
      
      // Send TikTok welcome message with photo, TikTok link and referral link
      welcomeSent = await this.telegramService.sendWelcomeWithTikTok(
        userId,
        userName,
        finalReferralLink
      );
    }

    if (!welcomeSent) {
      logger.warn('Failed to send welcome message', {
        userId,
        userName,
        reason: 'User might have privacy settings that block messages from bots'
      });
    }
  }

  /**
   * Handle errors during join request processing
   */
  private async handleJoinRequestError(error: unknown, joinRequest: any, chatTitle: string): Promise<void> {
    const userId = joinRequest.from.id;
    const userName = joinRequest.from.first_name;
    const chatId = joinRequest.chat.id;

    logger.error('Error processing chat join request', error as Error, {
      userId,
      userName,
      chatId,
      chatTitle
    });

    // Record the error as a rejection
    try {
      await this.userActivityService.recordRejection(
        userId,
        chatId,
        chatTitle,
        joinRequest.from,
        `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } catch (recordError) {
      logger.error('Failed to record join request error', recordError as Error, {
        originalError: error,
        userId,
        chatId
      });
    }
  }

  /**
   * Check if the channel is authorized for join requests
   */
  private isAuthorizedChannel(chatId: number): boolean {
    return chatId.toString() === config.channelId;
  }

  /**
   * Extract referral code from invite link name
   */
  private async extractReferralCodeFromInviteLink(inviteLinkName?: string): Promise<string | undefined> {
    if (!inviteLinkName) {
      return undefined;
    }
    
    // Extract referral code from link name format: "Referral: {referralCode}"
    const match = inviteLinkName.match(/^Referral: (.+)$/);
    if (match && match[1]) {
      logger.debug('Referral code extracted from invite link', {
        linkName: inviteLinkName,
        referralCode: match[1]
      });
      return match[1];
    }
    
    return undefined;
  }
}