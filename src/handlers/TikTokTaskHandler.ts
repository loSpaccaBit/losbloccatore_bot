import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { ContestService } from '../services/ContestService';
import messageService from '../services/MessageService';
import cache from '../utils/cache';
import config from '../config';
import logger from '../utils/logger';

/**
 * Handles TikTok task processing, validation, and callback management
 * Manages the TikTok task flow for users to earn points
 */
export class TikTokTaskHandler {
  constructor(
    private telegramService: TelegramService,
    private contestService: ContestService
  ) {}

  /**
   * Handle TikTok message processing (currently disabled in favor of button-only approach)
   */
  async handleTiktokMessage(ctx: Context): Promise<void> {
    if (!('message' in ctx.update) || !('text' in ctx.update.message)) {
      return;
    }

    const message = ctx.update.message;
    const userId = message.from?.id;
    const text = message.text;

    if (!userId || !text) {
      return;
    }

    // Ignore commands - let command handlers process them
    if (text.startsWith('/')) {
      return;
    }

    // TikTok verification is now only available through the welcome message buttons
    // Direct link submission has been disabled for security and user experience reasons
    logger.debug('TikTok message ignored - direct link submission disabled', {
      userId,
      messageText: text.substring(0, 50) + '...'
    });
    
    return;
  }

  /**
   * Handle TikTok button callback when user clicks "Ho visitato TikTok"
   */
  async handleTikTokCallback(ctx: Context): Promise<void> {
    if (!('callback_query' in ctx.update)) {
      return;
    }

    const callbackQuery = (ctx.update as any).callback_query;
    
    // Type guard to ensure we have a data callback query
    if (!('data' in callbackQuery) || !callbackQuery.data) {
      return;
    }

    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const userName = callbackQuery.from.first_name || 'User';

    try {
      // Check if it's a TikTok points callback
      if (data.startsWith('tiktok_points:')) {
        await this.processTikTokPointsCallback(ctx, data, userId, userName);
      }

    } catch (error) {
      await this.handleTikTokCallbackError(ctx, error, userId, userName, data);
    }
  }

  /**
   * Process TikTok points callback when user claims they visited TikTok
   */
  private async processTikTokPointsCallback(ctx: Context, data: string, userId: number, userName: string): Promise<void> {
    const callbackQuery = (ctx.update as any).callback_query;
    const targetUserId = parseInt(data.split(':')[1]);
    
    // Verify the callback is from the correct user
    if (userId !== targetUserId) {
      const errorMessage = await messageService.loadMessage('tiktok_button_not_for_you').catch(() => '❌ Questo pulsante non è per te!');
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
      return;
    }

    // Check timing requirements
    if (!(await this.isTimingRequirementMet(ctx, userId))) {
      return;
    }

    // Check if user already completed TikTok task
    const participant = await this.contestService.getOrCreateParticipant(
      userId,
      parseInt(config.channelId),
      userName,
      callbackQuery.from.last_name,
      callbackQuery.from.username
    );

    if (participant.tiktokTaskCompleted) {
      const completedMessage = await messageService.loadMessage('tiktok_already_completed').catch(() => '✅ Hai già completato il task TikTok!');
      await ctx.answerCbQuery(completedMessage, { show_alert: true });
      return;
    }

    // Award TikTok points and complete task
    await this.completeTikTokTask(ctx, userId, userName, participant);
  }

  /**
   * Check if user has waited enough time since welcome message
   */
  private async isTimingRequirementMet(ctx: Context, userId: number): Promise<boolean> {
    const welcomeTime = cache.get(`welcome_sent:${userId}`) as number;
    
    logger.debug('Checking TikTok timing requirement', {
      userId,
      welcomeTime,
      currentTime: Date.now(),
      timeSinceWelcome: welcomeTime ? Date.now() - welcomeTime : 'no_welcome_time'
    });
    
    if (!welcomeTime || Date.now() - welcomeTime < 30000) {
      const waitMessage = await messageService.loadMessage('tiktok_wait_required')
        .catch(() => '⚠️ Devi prima cliccare "Apri TikTok", visitare la pagina e seguire/commentare! Attendi almeno 30 secondi.');
      
      await ctx.answerCbQuery(waitMessage, { show_alert: true });
      
      logger.warn('TikTok timing requirement not met', {
        userId,
        welcomeTime,
        currentTime: Date.now(),
        timeSinceWelcome: welcomeTime ? Date.now() - welcomeTime : 'no_welcome_time'
      });
      return false;
    }
    
    logger.info('TikTok timing requirement met', {
      userId,
      timeSinceWelcome: Date.now() - welcomeTime
    });
    return true;
  }

  /**
   * Complete TikTok task and award points
   */
  private async completeTikTokTask(ctx: Context, userId: number, userName: string, participant: any): Promise<void> {
    // Award TikTok points and mark task as completed
    const tikTokSubmitted = await this.contestService.completeTiktokTaskViaButton(
      userId,
      parseInt(config.channelId)
    );

    if (tikTokSubmitted) {
      logger.info('TikTok task completed successfully, preparing success message', {
        userId,
        userName
      });

      // Get updated participant info
      const updatedParticipant = await this.contestService.getParticipantStats(userId, parseInt(config.channelId));
      const totalPoints = updatedParticipant?.points || 0;

      // Answer callback query with success message
      await ctx.answerCbQuery('🎉 TikTok visitato! +3 punti!', { show_alert: false });

      // Send detailed success message
      await this.sendTikTokSuccessMessage(ctx, userId, userName, totalPoints, participant);

      logger.info('TikTok task completed via button click', {
        userId,
        userName,
        pointsAwarded: 3,
        totalPoints,
        tiktokTaskCompleted: true
      });
    } else {
      logger.warn('TikTok task completion failed', {
        userId,
        userName,
        reason: 'completeTiktokTaskViaButton returned false'
      });
      await ctx.answerCbQuery('❌ Errore nell\'assegnare i punti. Riprova!', { show_alert: true });
    }
  }

  /**
   * Send success message after TikTok task completion
   */
  private async sendTikTokSuccessMessage(ctx: Context, userId: number, userName: string, totalPoints: number, participant: any): Promise<void> {
    // Get channel invite link for referral
    const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
    const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;

    logger.info('Sending TikTok success message using centralized template', {
      userId,
      userName,
      totalPoints,
      referralLink: finalReferralLink
    });

    // Send success message using centralized message service
    const messageSuccessfullySent = await this.telegramService.sendTikTokPointsMessage(
      userId,
      userName,
      totalPoints,
      finalReferralLink
    );

    if (messageSuccessfullySent) {
      logger.info('TikTok success message sent successfully via centralized service', { userId, userName });
    } else {
      logger.warn('Failed to send TikTok message via service, sending fallback message', { userId, userName });
      // Fallback message if centralized service fails
      await this.sendFallbackTikTokMessage(userId, totalPoints, finalReferralLink);
    }
  }

  /**
   * Send fallback TikTok success message when centralized service fails
   */
  private async sendFallbackTikTokMessage(userId: number, totalPoints: number, referralLink: string): Promise<void> {
    const bot = this.telegramService.getBot();
    await bot.telegram.sendMessage(
      userId, 
      `🎉 Complimenti! Hai completato il task TikTok: +3 punti!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${referralLink}`,
      { link_preview_options: { is_disabled: true } }
    );
  }

  /**
   * Handle errors during TikTok callback processing
   */
  private async handleTikTokCallbackError(ctx: Context, error: unknown, userId: number, userName: string, data: string): Promise<void> {
    logger.error('Error handling TikTok callback', error as Error, {
      userId,
      userName,
      callbackData: data
    });
    
    try {
      await ctx.answerCbQuery('❌ Errore durante l\'elaborazione. Riprova più tardi.', { show_alert: true });
    } catch (answerError) {
      logger.error('Failed to answer callback query', answerError as Error, {
        originalError: error,
        userId,
        userName
      });
    }
  }


  /**
   * Check if user has already completed TikTok task
   */
  async hasUserCompletedTikTokTask(userId: number): Promise<boolean> {
    try {
      const participant = await this.contestService.getParticipantStats(userId, parseInt(config.channelId));
      return participant?.tiktokTaskCompleted || false;
    } catch (error) {
      logger.error('Error checking TikTok task completion status', error as Error, { userId });
      return false;
    }
  }

  /**
   * Get TikTok task statistics for a user
   */
  async getTikTokTaskStats(userId: number): Promise<{completed: boolean, pointsEarned: number, completionDate?: Date} | null> {
    try {
      const participant = await this.contestService.getParticipantStats(userId, parseInt(config.channelId));
      
      if (!participant) {
        return null;
      }

      return {
        completed: participant.tiktokTaskCompleted,
        pointsEarned: participant.tiktokTaskCompleted ? 3 : 0,
        // Note: completion date would need to be added to the database schema
      };
    } catch (error) {
      logger.error('Error getting TikTok task stats', error as Error, { userId });
      return null;
    }
  }
}