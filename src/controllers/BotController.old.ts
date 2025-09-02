import { Context } from 'telegraf';
import { TelegramService } from '../services/TelegramService';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
import messageService from '../services/MessageService';
import cache from '../utils/cache';
import { ChatJoinRequestEvent, ChatMemberUpdate } from '../types/index';
import config from '../config/index';
import logger from '../utils/logger';
import leaderboardScheduler from '../services/LeaderboardSchedulerService';

export class BotController {
  private telegramService: TelegramService;
  private userActivityService: UserActivityService;
  private contestService: ContestService;

  constructor() {
    this.telegramService = new TelegramService();
    this.userActivityService = new UserActivityService();
    this.contestService = new ContestService();
  }

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
      // Check if the request is for the authorized channel
      if (chatId.toString() !== config.channelId) {
        logger.info('Join request ignored - unauthorized channel', {
          requestedChatId: chatId,
          authorizedChatId: config.channelId,
          userId,
          userName
        });
        return;
      }

      // Check if this join request came from a referral invite link
      let referralCode: string | undefined;
      if (joinRequest.invite_link) {
        // Try to extract referral code from invite link metadata
        referralCode = await this.extractReferralCodeFromInviteLink(joinRequest.invite_link.name);
        if (referralCode) {
          logger.info('Join request via referral invite link detected', {
            userId,
            userName,
            referralCode,
            inviteLinkName: joinRequest.invite_link.name
          });
        }
      }

      // Record the join request
      const joinRequestEvent: ChatJoinRequestEvent = {
        user: joinRequest.from,
        chat: joinRequest.chat,
        date: joinRequest.date
      };

      await this.userActivityService.recordJoinRequest(joinRequestEvent);

      // Check if user has joined before (optional business logic)
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
        logger.logUserApproved(userId, userName, chatId, chatTitle);

        // Record the approval
        await this.userActivityService.recordApproval(userId, chatId, chatTitle, joinRequest.from);

        // Create contest participant with referral if detected from invite link
        await this.contestService.getOrCreateParticipant(
          userId,
          chatId,
          userName,
          joinRequest.from.last_name,
          joinRequest.from.username,
          referralCode
        );

        // Get participant info and generate channel invite link
        const participantInfo = await this.contestService.getParticipantStats(userId, chatId);
        const userReferralCode = participantInfo?.referralCode || userId.toString();
        
        // Generate a direct channel invite link instead of a bot link
        const referralLink = await this.telegramService.getReferralInviteLink(userReferralCode);
        
        // Fallback to bot link if invite link creation fails
        const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${userReferralCode}`;

        // Check if user has already completed TikTok task
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

      } else {
        logger.error('Failed to approve join request', undefined, {
          userId,
          userName,
          chatId,
          chatTitle
        });

        // Record the failure (could be treated as a rejection)
        await this.userActivityService.recordRejection(
          userId,
          chatId,
          chatTitle,
          joinRequest.from,
          'Failed to approve via Telegram API'
        );
      }

    } catch (error) {
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
  }

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
      // Skip processing if this is about the bot itself
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

      // Only process events for the authorized channel
      if (chatId.toString() !== config.channelId) {
        logger.debug('Member update ignored - unauthorized channel', {
          chatId,
          authorizedChatId: config.channelId
        });
        return;
      }

      const memberStatuses = ['member', 'administrator', 'creator'];
      const leftStatuses = ['left', 'kicked', 'banned'];

      const wasActive = memberStatuses.includes(oldStatus);
      const isLeft = leftStatuses.includes(newStatus);

      // User left the channel
      if (wasActive && isLeft) {
        logger.logUserLeft(user.id, user.first_name, chatId, chatTitle);

        // Record the leave event
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

        await this.userActivityService.recordUserLeave(chatMemberUpdateEvent);

        // Handle contest participant leaving (revoke referral points)
        await this.contestService.handleUserLeft(user.id, chatId);

        // Send goodbye message
        const goodbyeSent = await this.telegramService.sendGoodbyeMessage(
          user.id,
          user.first_name,
          {
            includeReturnMessage: true
          }
        );

        if (!goodbyeSent) {
          logger.info('Could not send goodbye message', {
            userId: user.id,
            username: user.username,
            reason: 'User privacy settings or bot was blocked'
          });
        }
      }
      // User joined the channel (alternative to join request)
      else if (!wasActive && memberStatuses.includes(newStatus)) {
        logger.info('User joined channel via member update', {
          userId: user.id,
          username: user.username,
          firstName: user.first_name,
          chatId,
          newStatus
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
      // Only process events for the authorized channel
      if (chatId.toString() !== config.channelId) {
        logger.debug('Left member event ignored - unauthorized channel', {
          chatId,
          authorizedChatId: config.channelId
        });
        return;
      }

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
      const goodbyeSent = await this.telegramService.sendGoodbyeMessage(
        leftUser.id,
        leftUser.first_name,
        {
          includeReturnMessage: true
        }
      );

      if (!goodbyeSent) {
        logger.info('Could not send goodbye message via left_chat_member', {
          userId: leftUser.id,
          username: leftUser.username,
          possibleCauses: [
            'User blocked the bot',
            'Privacy settings prevent messages',
            'Group size >50 members'
          ]
        });
      }

    } catch (error) {
      logger.error('Error processing left chat member', error as Error, {
        userId: leftUser.id,
        username: leftUser.username,
        chatId
      });
    }
  }

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
    // Direct link submission has been disabled
    return;
  }

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
      let referralCode: string | undefined;
      if ('text' in message && message.text) {
        const startPayload = message.text.split(' ')[1]; // Gets the parameter after /start
        if (startPayload && startPayload !== userId.toString()) {
          // If it's not the user's own ID, it's a referral code
          referralCode = startPayload;
          logger.info('Start command with referral', { userId, userName, referralCode });
        } else {
          logger.info('Start command without referral', { userId, userName });
        }
      }

      // Create participant with or without referral (use configured channel ID for contest)
      const channelId = parseInt(config.channelId);
      const participant = await this.contestService.getOrCreateParticipant(
        userId,
        channelId, // Always use the channel ID for contest participants
        userName,
        message.from.last_name,
        message.from.username,
        referralCode
      );

      // Generate channel invite link for this user using their referralCode
      const userReferralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
      
      // Fallback to bot link if invite link creation fails
      const finalUserReferralLink = userReferralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;

      // Get participant stats
      const stats = await this.contestService.getParticipantStats(userId, channelId);
      const totalPoints = stats?.points || 0;

      // Send welcome message with contest info using centralized template
      try {
        const messageContent = await messageService.loadMessage('contest_welcome', {
          variables: {
            userName,
            totalPoints,
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

      logger.info('Start command processed successfully', {
        userId,
        userName,
        chatId,
        hadReferral: !!referralCode,
        totalPoints
      });

    } catch (error) {
      logger.error('Error handling start command', error as Error, {
        userId,
        userName,
        chatId
      });
      await ctx.reply('❌ Errore durante l\'inizializzazione. Riprova più tardi.');
    }
  }

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

      // Process message content with custom Markdown parser
      const processedContent = this.telegramService.processMarkdownText(messageContent);
      
      try {
        await ctx.reply(processedContent, { parse_mode: 'Markdown' });
        logger.info('Markdown message sent successfully with custom parser', {
          userId,
          userName
        });
      } catch (markdownError) {
        logger.warn('Custom Markdown parsing still failed, sending as plain text', {
          error: markdownError,
          userId,
          userName
        });
        // Remove markdown formatting and send as plain text
        const plainText = messageContent.replace(/\*\*/g, '').replace(/\*/g, '');
        await ctx.reply(plainText);
      }
      
    } catch (error) {
      logger.error('Error handling classifica command', error as Error, {
        userId,
        userName
      });
      await ctx.reply('❌ Errore durante il recupero delle tue statistiche. Riprova più tardi.');
    }
  }

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

    // This is useful for monitoring when the bot is added/removed from channels
    if (newStatus === 'administrator' && oldStatus !== 'administrator') {
      logger.info('Bot promoted to administrator', { chatId, chatTitle });
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      logger.warn('Bot removed from chat', { chatId, chatTitle, newStatus });
    } else if (newStatus === 'member' && (oldStatus === 'left' || oldStatus === 'kicked')) {
      logger.info('Bot added back to chat', { chatId, chatTitle });
    }
  }

  async handleTikTokCallback(ctx: Context): Promise<void> {
    if (!('callback_query' in ctx.update)) {
      return;
    }

    const callbackQuery = ctx.update.callback_query;
    
    // Type guard to ensure we have a data callback query
    if (!('data' in callbackQuery) || !callbackQuery.data) {
      return;
    }

    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const userName = callbackQuery.from.first_name || 'User';

    try {
      // Check if it's a TikTok points callback (user clicked "Ho visitato TikTok")  
      if (data.startsWith('tiktok_points:')) {
        const targetUserId = parseInt(data.split(':')[1]);
        
        // Verify the callback is from the correct user
        if (userId !== targetUserId) {
          const errorMessage = await messageService.loadMessage('tiktok_button_not_for_you').catch(() => '❌ Questo pulsante non è per te!');
          await ctx.answerCbQuery(errorMessage, { show_alert: true });
          return;
        }

        // Check if enough time has passed since welcome message (minimum 30 seconds to visit TikTok)
        const welcomeTime = cache.get(`welcome_sent:${userId}`) as number;
        if (!welcomeTime || Date.now() - welcomeTime < 30000) {
          const waitMessage = await messageService.loadMessage('tiktok_wait_required').catch(() => '⚠️ Devi prima cliccare "Apri TikTok", visitare la pagina e seguire/commentare! Attendi almeno 30 secondi.');
          await ctx.answerCbQuery(waitMessage, { show_alert: true });
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

        // Award TikTok points and mark task as completed directly
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

          // Answer callback query
          await ctx.answerCbQuery('🎉 TikTok visitato! +3 punti!', { show_alert: false });

          // Get channel invite link for referral
          const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
          const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;

          logger.info('Sending TikTok success message using centralized template', {
            userId,
            userName,
            totalPoints,
            referralLink
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
            await this.telegramService.getBot().telegram.sendMessage(userId, 
              `🎉 Complimenti! Hai completato il task TikTok: +3 punti!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${finalReferralLink}`,
              { link_preview_options: { is_disabled: true } }
            );
          }

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

    } catch (error) {
      logger.error('Error handling TikTok callback', error as Error, {
        userId,
        userName,
        callbackData: data
      });
      
      try {
        await ctx.answerCbQuery('❌ Errore durante l\'elaborazione. Riprova più tardi.', { show_alert: true });
      } catch (answerError) {
        logger.error('Failed to answer callback query', answerError as Error);
      }
    }
  }

  getTelegramService(): TelegramService {
    return this.telegramService;
  }

  getUserActivityService(): UserActivityService {
    return this.userActivityService;
  }

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

      // Process message content with custom Markdown parser
      const processedContent = this.telegramService.processMarkdownText(helpMessage);
      
      try {
        await ctx.reply(processedContent, { 
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true }
        });
        logger.info('Help command processed successfully', {
          userId,
          userName
        });
      } catch (markdownError) {
        logger.warn('Custom Markdown parsing failed for help message, sending as plain text', {
          error: markdownError,
          userId,
          userName
        });
        // Remove markdown formatting and send as plain text
        const plainText = helpMessage.replace(/\*/g, '').replace(/_/g, '');
        await ctx.reply(plainText, { link_preview_options: { is_disabled: true } });
      }

    } catch (error) {
      logger.error('Error handling help command', error as Error, {
        userId,
        userName
      });
      
      // Fallback help message
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
  }

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

      // Generate channel invite link using their referralCode
      const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
      
      // Fallback to bot link if invite link creation fails
      const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;

      // Get participant stats for points
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

        // Process message content with custom Markdown parser
        const processedContent = this.telegramService.processMarkdownText(linkMessage);
        
        try {
          await ctx.reply(processedContent, { 
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true }
          });
        } catch (markdownError) {
          logger.warn('Custom Markdown parsing failed for link message, sending as plain text', {
            error: markdownError,
            userId,
            userName
          });
          // Remove markdown formatting and send as plain text
          const plainText = linkMessage.replace(/\*/g, '').replace(/_/g, '');
          await ctx.reply(plainText, { link_preview_options: { is_disabled: true } });
        }
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

      logger.info('Link command processed successfully', {
        userId,
        userName,
        referralCode: participant.referralCode,
        totalPoints
      });

    } catch (error) {
      logger.error('Error handling link command', error as Error, {
        userId,
        userName
      });
      
      await ctx.reply('❌ Errore durante il recupero del tuo link. Riprova più tardi.');
    }
  }

  async handleGenerateClassificaCommand(ctx: Context): Promise<void> {
    if (!('message' in ctx.update)) {
      return;
    }

    const message = ctx.update.message;
    const userId = message.from?.id;

    if (!userId || !this.isAdmin(userId)) {
      await ctx.reply('❌ Comando disponibile solo per gli amministratori.');
      return;
    }

    try {
      await ctx.reply('🔄 Generando la classifica...');
      
      await leaderboardScheduler.sendLeaderboardNow();
      
      await ctx.reply('✅ Classifica generata e inviata nel canale!');
      
      logger.info('Manual leaderboard generation triggered by admin', { 
        adminUserId: userId 
      });
      
    } catch (error) {
      await ctx.reply('❌ Errore durante la generazione della classifica.');
      logger.error('Failed to generate manual leaderboard', error as Error, { 
        adminUserId: userId 
      });
    }
  }

  private isAdmin(userId: number): boolean {
    return config.adminUserId !== undefined && config.adminUserId === userId;
  }

  getContestService(): ContestService {
    return this.contestService;
  }

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