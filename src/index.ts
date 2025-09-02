import { BotController } from './controllers/BotController';
import { ErrorHandler } from './middleware/ErrorHandler';
import { LoggingMiddleware } from './middleware/LoggingMiddleware';
import { TikTokTrackingMiddleware } from './middleware/TikTokTrackingMiddleware';
import DIContainer from './core/DIContainer';
import databaseConnection from './database/connection';
import config from './config/index';
import logger from './utils/logger';
import leaderboardScheduler from './services/LeaderboardSchedulerService';

class Application {
  private botController: BotController | null = null;

  constructor() {
    // BotController will be instantiated after dependency injection setup
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Starting LosBloccatore Bot v2.0.0 - Refactored Architecture', {
        environment: config.environment,
        channelId: config.channelId,
        nodeVersion: process.version
      });

      // Initialize database connection
      logger.info('📊 Initializing database connection...');
      await databaseConnection.initialize();
      logger.info('✅ Database connection established');

      // Initialize dependency injection container
      logger.info('🔧 Initializing dependency injection container...');
      const services = DIContainer.initialize();
      logger.info('✅ DI Container initialized with all services');

      // Initialize BotController with dependency injection
      logger.info('🎮 Initializing refactored bot controller...');
      this.botController = new BotController(services);
      logger.info('✅ Bot controller initialized with all handlers');

      // Setup Telegram bot with middleware
      logger.info('🤖 Setting up Telegram bot...');
      const telegramService = services.telegramService;
      const bot = telegramService.getBot();

      // Apply middleware in order
      bot.use(LoggingMiddleware.createRequestLoggingMiddleware());
      bot.use(TikTokTrackingMiddleware.createTikTokTrackingMiddleware()); // Track TikTok links
      bot.use(LoggingMiddleware.createPerformanceLoggingMiddleware(2000)); // 2 second threshold
      bot.use(TikTokTrackingMiddleware.createTikTokInteractionMiddleware()); // Track TikTok processing
      bot.use(LoggingMiddleware.createSecurityLoggingMiddleware());
      bot.use(ErrorHandler.createRateLimitMiddleware(30, 60)); // 30 requests per minute
      bot.use(ErrorHandler.createValidationMiddleware());
      bot.use(ErrorHandler.createTelegramMiddleware());

      if (config.environment === 'development') {
        bot.use(LoggingMiddleware.createDetailedLoggingMiddleware());
      }

      // Setup bot event handlers
      this.setupBotHandlers(bot);

      // Start the bot
      logger.info('📡 Starting bot polling...');
      await telegramService.startPolling();

      // Start leaderboard scheduler
      logger.info('📊 Starting leaderboard scheduler...');
      leaderboardScheduler.start();

      // Check bot permissions in the channel
      await this.checkBotPermissions(services.telegramService);

      logger.info('🎉 Bot started successfully', {
        timestamp: new Date().toISOString(),
        process: process.pid,
        leaderboardScheduler: leaderboardScheduler.getStatus()
      });

    } catch (error) {
      logger.error('❌ Failed to initialize application', error as Error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private setupBotHandlers(bot: any): void {
    // Chat join request handler
    bot.on('chat_join_request', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleChatJoinRequest(ctx);
      }
    });

    // Chat member status changes (for larger channels)
    bot.on('chat_member', async (ctx: any) => {
      logger.info('🔍 chat_member event received', {
        chatId: ctx.update.chat_member?.chat.id,
        userId: ctx.update.chat_member?.new_chat_member?.user?.id,
        username: ctx.update.chat_member?.new_chat_member?.user?.username,
        firstName: ctx.update.chat_member?.new_chat_member?.user?.first_name,
        oldStatus: ctx.update.chat_member?.old_chat_member?.status,
        newStatus: ctx.update.chat_member?.new_chat_member?.status,
        eventType: 'chat_member',
        updateType: ctx.updateType
      });
      
      if (this.botController) {
        await this.botController.handleChatMemberUpdate(ctx);
      }
    });

    // Bot's own membership status changes
    bot.on('my_chat_member', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleMyChatMember(ctx);
      }
    });

    // Left chat member (for smaller groups)
    bot.on('left_chat_member', async (ctx: any) => {
      logger.info('🔍 left_chat_member event received', {
        chatId: ctx.update.message?.chat?.id,
        userId: ctx.update.message?.left_chat_member?.id,
        username: ctx.update.message?.left_chat_member?.username,
        firstName: ctx.update.message?.left_chat_member?.first_name,
        eventType: 'left_chat_member',
        updateType: ctx.updateType
      });
      
      if (this.botController) {
        await this.botController.handleLeftChatMember(ctx);
      }
    });

    // Start command (handles referral links)
    bot.start(async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleStartCommand(ctx);
      }
    });

    // Personal statistics command
    bot.command('classifica', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleClassificaCommand(ctx);
      }
    });

    // Help command
    bot.command('help', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleHelpCommand(ctx);
      }
    });

    // Link command for referral links
    bot.command('link', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleLinkCommand(ctx);
      }
    });

    // Admin command to generate leaderboard manually
    bot.command('genera_classifica', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleGenerateClassificaCommand(ctx);
      }
    });

    // Text messages for TikTok links (must be AFTER commands)
    bot.on('text', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleTiktokMessage(ctx);
      }
    });

    // Callback queries for inline keyboards
    bot.on('callback_query', async (ctx: any) => {
      if (this.botController) {
        await this.botController.handleTikTokCallback(ctx);
      }
    });

    logger.info('✅ Bot event handlers configured');
  }

  private async checkBotPermissions(telegramService: any): Promise<void> {
    try {
      const bot = telegramService.getBot();
      const channelId = parseInt(config.channelId);
      
      logger.info('🔍 Checking bot permissions in channel', {
        channelId,
        channelIdString: config.channelId
      });

      // Get bot info
      const botInfo = await bot.telegram.getMe();
      logger.info('Bot information', {
        botId: botInfo.id,
        botUsername: botInfo.username,
        botName: botInfo.first_name
      });

      // Try to get bot member status in the channel
      try {
        const botMember = await bot.telegram.getChatMember(channelId, botInfo.id);
        
        logger.info('Bot permissions in channel', {
          channelId,
          botStatus: botMember.status,
          permissions: {
            can_invite_users: botMember.can_invite_users,
            can_manage_chat: botMember.can_manage_chat,
            can_delete_messages: botMember.can_delete_messages,
            can_restrict_members: botMember.can_restrict_members,
            can_promote_members: botMember.can_promote_members,
            can_change_info: botMember.can_change_info,
            can_post_messages: botMember.can_post_messages,
            can_edit_messages: botMember.can_edit_messages,
            can_pin_messages: botMember.can_pin_messages
          }
        });

        if (botMember.status !== 'administrator') {
          logger.warn('⚠️ Bot is not an administrator in the channel - chat_member events may not be received', {
            channelId,
            currentStatus: botMember.status,
            recommendation: 'Make the bot an administrator to receive leave events'
          });
        } else {
          logger.info('✅ Bot has administrator privileges - should receive chat_member events');
        }

      } catch (permissionError) {
        logger.error('❌ Failed to check bot permissions in channel', permissionError as Error, {
          channelId,
          error: permissionError instanceof Error ? permissionError.message : 'Unknown error',
          possibleReasons: [
            'Bot is not a member of the channel',
            'Bot was removed from the channel',
            'Channel ID is incorrect',
            'Bot token is invalid'
          ]
        });
      }

    } catch (error) {
      logger.error('❌ Error during bot permissions check', error as Error);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 Received ${signal} - Starting graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle PM2 reload
    process.once('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
  }

  private async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down application...');

      // Stop leaderboard scheduler
      if (leaderboardScheduler.isActive()) {
        leaderboardScheduler.stop();
        logger.info('✅ Leaderboard scheduler stopped');
      }

      // Stop Telegram bot if it was initialized
      if (this.botController) {
        const services = DIContainer.getServices();
        await services.telegramService.stop();
        logger.info('✅ Telegram bot stopped');
      }

      // Close database connection
      await databaseConnection.close();
      logger.info('✅ Database connection closed');

      logger.info('✅ Application shutdown completed');

    } catch (error) {
      logger.error('❌ Error during shutdown', error as Error);
    }
  }

  async start(): Promise<void> {
    this.setupGracefulShutdown();
    await this.initialize();
  }
}

// Start the application
const app = new Application();

app.start().catch((error) => {
  logger.error('❌ Failed to start application', error);
  process.exit(1);
});