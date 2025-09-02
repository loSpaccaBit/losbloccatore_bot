import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { ContestService } from '../services/ContestService';
import messageService from '../services/MessageService';
import config from '../config';
import logger from '../utils/logger';

/**
 * Handles all user commands (/start, /help, /link, /classifica)
 * Focused on user-facing command processing and response generation
 */
export class CommandHandler {
  constructor(
    private telegramService: TelegramService,
    private contestService: ContestService
  ) {}

  /**
   * Handle /start command with optional referral code
   */
  async handleStartCommand(ctx: Context): Promise<void> {
    if (!('message' in ctx.update) || !ctx.update.message.from) {
      return;
    }

    const message = ctx.update.message;
    const userId = message.from.id;
    const userName = message.from.first_name || 'User';
    const chatId = message.chat.id;

    try {
      // Extract referral code from the start command
      const referralCode = this.extractReferralCodeFromStart(message);
      
      if (referralCode) {
        logger.info('Start command with referral', { userId, userName, referralCode });
      } else {
        logger.info('Start command without referral', { userId, userName });
      }

      // Create participant with or without referral
      const channelId = parseInt(config.channelId);
      const participant = await this.contestService.getOrCreateParticipant(
        userId,
        channelId, // Always use the channel ID for contest participants
        userName,
        message.from.last_name,
        message.from.username,
        referralCode
      );

      // Send welcome response
      await this.sendStartCommandResponse(ctx, participant, userId, userName);

      logger.info('Start command processed successfully', {
        userId,
        userName,
        chatId,
        hadReferral: !!referralCode,
        totalPoints: participant.points
      });

    } catch (error) {
      await this.handleCommandError(ctx, error, 'start');
    }
  }

  /**
   * Handle /classifica command - show user's personal statistics
   */
  async handleClassificaCommand(ctx: Context): Promise<void> {
    if (!('message' in ctx.update)) {
      return;
    }

    const message = ctx.update.message;
    const userId = message.from?.id;
    const userName = message.from?.first_name || 'User';

    if (!userId) {
      return;
    }

    try {
      const channelId = parseInt(config.channelId);
      
      // Get user's personal stats
      const participant = await this.contestService.getUserPersonalStats(userId, channelId);
      
      if (!participant) {
        await ctx.reply('❌ Non sei ancora registrato nel contest. Unisciti al canale per iniziare!');
        return;
      }

      if (!participant.isActive) {
        await ctx.reply('❌ Il tuo profilo non è attivo. Unisciti nuovamente al canale per partecipare!');
        return;
      }

      // Send personal statistics
      await this.sendPersonalStatistics(ctx, participant, userId, userName);
      
    } catch (error) {
      await this.handleCommandError(ctx, error, 'classifica');
    }
  }

  /**
   * Handle /help command - show available commands and instructions
   */
  async handleHelpCommand(ctx: Context): Promise<void> {
    if (!('message' in ctx.update)) {
      return;
    }

    const message = ctx.update.message;
    const userId = message.from?.id;
    const userName = message.from?.first_name || 'User';

    if (!userId) {
      return;
    }

    try {
      // Load help message from template
      const helpMessage = await messageService.loadMessage('help', {
        variables: {
          userName
        }
      });

      // Send help message with markdown processing
      await this.sendMarkdownMessage(ctx, helpMessage, 'help');

      logger.info('Help command processed successfully', {
        userId,
        userName
      });

    } catch (error) {
      await this.sendFallbackHelpMessage(ctx);
      logger.error('Error handling help command', error as Error, {
        userId,
        userName
      });
    }
  }

  /**
   * Handle /link command - show user's referral link
   */
  async handleLinkCommand(ctx: Context): Promise<void> {
    if (!('message' in ctx.update)) {
      return;
    }

    const message = ctx.update.message;
    const userId = message.from?.id;
    const userName = message.from?.first_name || 'User';

    if (!userId) {
      return;
    }

    try {
      const channelId = parseInt(config.channelId);
      
      // Get or create participant to get referral code
      const participant = await this.contestService.getOrCreateParticipant(
        userId,
        channelId,
        userName,
        message.from?.last_name,
        message.from?.username
      );

      // Send referral link information
      await this.sendReferralLinkInfo(ctx, participant, userId, userName);

      logger.info('Link command processed successfully', {
        userId,
        userName,
        referralCode: participant.referralCode,
        totalPoints: participant.points
      });

    } catch (error) {
      await this.handleCommandError(ctx, error, 'link');
    }
  }

  /**
   * Extract referral code from /start command text
   */
  private extractReferralCodeFromStart(message: any): string | undefined {
    if ('text' in message && message.text) {
      const startPayload = message.text.split(' ')[1]; // Gets the parameter after /start
      if (startPayload && startPayload !== message.from.id.toString()) {
        // If it's not the user's own ID, it's a referral code
        return startPayload;
      }
    }
    return undefined;
  }

  /**
   * Send /start command response with contest info
   */
  private async sendStartCommandResponse(ctx: Context, participant: any, userId: number, userName: string): Promise<void> {
    // Generate referral link for this user
    const userReferralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
    
    // Fallback to bot link if invite link creation fails
    const finalUserReferralLink = userReferralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;

    // Get participant stats
    const channelId = parseInt(config.channelId);
    const stats = await this.contestService.getParticipantStats(userId, channelId);
    const totalPoints = stats?.points || 0;

    // Send welcome message with contest info using centralized template
    try {
      const messageContent = await messageService.loadMessage('contest_welcome', {
        variables: {
          userName,
          totalPoints: totalPoints.toString(),
          referralLink: finalUserReferralLink
        }
      });

      await ctx.reply(messageContent, { parse_mode: 'Markdown' });
      logger.info('Contest welcome message sent successfully', { userId, userName });
    } catch (error) {
      logger.error('Failed to send contest welcome message', error as Error, { userId, userName });
      // Fallback message
      await ctx.reply(
        `🎯 Benvenuto ${userName}!\n\nPunti attuali: ${totalPoints}\nTuo link: ${finalUserReferralLink}\n\nUsa /classifica per vedere la tua posizione!`
      );
    }
  }

  /**
   * Send personal statistics for /classifica command
   */
  private async sendPersonalStatistics(ctx: Context, participant: any, _userId: number, _userName: string): Promise<void> {
    // Prepare variables for message template
    const tiktokPoints = participant.parsedTiktokLinks.length * 3;
    const referralPoints = participant.referralCount * 2;
    
    const variables = {
      displayName: participant.displayName,
      totalPoints: participant.points.toString(),
      tiktokCompleted: participant.tiktokTaskCompleted ? '✅ Sì' : '❌ No',
      tiktokLinksCount: participant.parsedTiktokLinks.length.toString(),
      tiktokPoints: tiktokPoints.toString(),
      referralCount: participant.referralCount.toString(),
      referralPoints: referralPoints.toString(),
      referralCode: participant.referralCode
    };

    // Load message from template
    const messageContent = await messageService.loadMessage('personal_stats', {
      variables
    });

    // Send statistics with markdown processing
    await this.sendMarkdownMessage(ctx, messageContent, 'personal_stats');
  }

  /**
   * Send referral link information for /link command
   */
  private async sendReferralLinkInfo(ctx: Context, participant: any, userId: number, userName: string): Promise<void> {
    // Generate channel invite link using their referralCode
    const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
    
    // Fallback to bot link if invite link creation fails
    const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;

    // Get participant stats for points
    const channelId = parseInt(config.channelId);
    const stats = await this.contestService.getParticipantStats(userId, channelId);
    const totalPoints = stats?.points || 0;

    // Load link message from template
    try {
      const linkMessage = await messageService.loadMessage('referral_link', {
        variables: {
          userName,
          referralLink: finalReferralLink,
          totalPoints: totalPoints.toString(),
          referralCode: participant.referralCode
        }
      });

      await this.sendMarkdownMessage(ctx, linkMessage, 'referral_link');
    } catch (templateError) {
      // Fallback link message
      await ctx.reply(
        `🔗 *Il tuo link referral*\n\n` +
        `👋 Ciao ${userName}!\n\n` +
        `📊 Punti attuali: *${totalPoints}*\n\n` +
        `🎯 *Il tuo link personale:*\n` +
        `${finalReferralLink}\n\n` +
        `💡 *Come usarlo:*\n` +
        `• Condividi questo link con i tuoi amici\n` +
        `• Ogni persona che si unisce ti fa guadagnare 2 punti\n` +
        `• Più amici inviti, più punti accumuli!\n\n` +
        `📈 Usa /classifica per vedere le tue statistiche complete.`,
        { 
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true }
        }
      );
    }
  }

  /**
   * Send markdown message with fallback to plain text
   */
  private async sendMarkdownMessage(ctx: Context, messageContent: string, commandType: string): Promise<void> {
    // Process message content with custom Markdown parser
    const processedContent = this.telegramService.processMarkdownText(messageContent);
    
    try {
      const replyOptions: any = { 
        parse_mode: 'Markdown' as const
      };

      // Add link preview disable for certain command types
      if (['help', 'referral_link'].includes(commandType)) {
        replyOptions.link_preview_options = { is_disabled: true };
      }

      await ctx.reply(processedContent, replyOptions);
      logger.info(`Markdown message sent successfully for ${commandType}`);
    } catch (markdownError) {
      logger.warn(`Custom Markdown parsing failed for ${commandType}, sending as plain text`, {
        error: markdownError
      });
      
      // Remove markdown formatting and send as plain text
      const plainText = messageContent.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');
      const plainOptions: any = {};
      
      if (['help', 'referral_link'].includes(commandType)) {
        plainOptions.link_preview_options = { is_disabled: true };
      }
      
      await ctx.reply(plainText, plainOptions);
    }
  }

  /**
   * Send fallback help message when template loading fails
   */
  private async sendFallbackHelpMessage(ctx: Context): Promise<void> {
    await ctx.reply(
      `🆘 *Aiuto - LosBloccatore Bot*\n\n` +
      `📋 *Comandi disponibili:*\n` +
      `/start - Inizia e ottieni il tuo link referral\n` +
      `/help - Mostra questo messaggio di aiuto\n` +
      `/link - Ottieni il tuo link referral\n` +
      `/classifica - Vedi le tue statistiche\n\n` +
      `🎯 *Come funziona:*\n` +
      `• Unisciti al canale per partecipare\n` +
      `• Visita TikTok per guadagnare 3 punti\n` +
      `• Invita amici per guadagnare 2 punti ciascuno\n` +
      `• Usa il tuo link personale per invitare`,
      { parse_mode: 'Markdown' }
    );
  }

  /**
   * Handle command processing errors with user-friendly messages
   */
  private async handleCommandError(ctx: Context, error: unknown, commandType: string): Promise<void> {
    logger.error(`Error handling ${commandType} command`, error as Error);

    const errorMessages = {
      start: '❌ Errore durante l\'inizializzazione. Riprova più tardi.',
      classifica: '❌ Errore durante il recupero delle tue statistiche. Riprova più tardi.',
      link: '❌ Errore durante il recupero del tuo link. Riprova più tardi.',
      help: '❌ Errore durante il caricamento dell\'aiuto. Riprova più tardi.'
    };

    await ctx.reply(errorMessages[commandType as keyof typeof errorMessages] || '❌ Errore durante l\'esecuzione del comando.');
  }
}