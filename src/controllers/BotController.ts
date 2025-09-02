import { Context } from 'telegraf';
import { JoinRequestHandler } from '../handlers/JoinRequestHandler';
import { MemberLifecycleHandler } from '../handlers/MemberLifecycleHandler';
import { CommandHandler } from '../handlers/CommandHandler';
import { TikTokTaskHandler } from '../handlers/TikTokTaskHandler';
import { AdminCommandHandler } from '../handlers/AdminCommandHandler';
import { BotStatusHandler } from '../handlers/BotStatusHandler';
import { ServiceContainer } from '../core/DIContainer';
import logger from '../utils/logger';

/**
 * Refactored BotController - Now acts as a lightweight orchestrator
 * Delegates specific responsibilities to focused handlers
 * Follows the Single Responsibility Principle and Dependency Injection patterns
 */
export class BotController {
  private joinRequestHandler: JoinRequestHandler;
  private memberLifecycleHandler: MemberLifecycleHandler;
  private commandHandler: CommandHandler;
  private tikTokTaskHandler: TikTokTaskHandler;
  private adminCommandHandler: AdminCommandHandler;
  private botStatusHandler: BotStatusHandler;

  constructor(services: ServiceContainer) {
    // Initialize all handlers with their required dependencies
    this.joinRequestHandler = new JoinRequestHandler(
      services.telegramService,
      services.userActivityService,
      services.contestService
    );

    this.memberLifecycleHandler = new MemberLifecycleHandler(
      services.telegramService,
      services.userActivityService,
      services.contestService
    );

    this.commandHandler = new CommandHandler(
      services.telegramService,
      services.contestService
    );

    this.tikTokTaskHandler = new TikTokTaskHandler(
      services.telegramService,
      services.contestService
    );

    this.adminCommandHandler = new AdminCommandHandler(
      services.userActivityService
    );

    this.botStatusHandler = new BotStatusHandler();

    logger.info('BotController initialized with all handlers');
  }

  /**
   * Handle chat join requests - delegate to JoinRequestHandler
   */
  async handleChatJoinRequest(ctx: Context): Promise<void> {
    try {
      await this.joinRequestHandler.handleChatJoinRequest(ctx);
    } catch (error) {
      logger.error('Error in chat join request handling', error as Error);
    }
  }

  /**
   * Handle chat member updates - delegate to MemberLifecycleHandler
   */
  async handleChatMemberUpdate(ctx: Context): Promise<void> {
    try {
      await this.memberLifecycleHandler.handleChatMemberUpdate(ctx);
    } catch (error) {
      logger.error('Error in chat member update handling', error as Error);
    }
  }

  /**
   * Handle left chat member events - delegate to MemberLifecycleHandler
   */
  async handleLeftChatMember(ctx: Context): Promise<void> {
    try {
      await this.memberLifecycleHandler.handleLeftChatMember(ctx);
    } catch (error) {
      logger.error('Error in left chat member handling', error as Error);
    }
  }

  /**
   * Handle TikTok message processing - delegate to TikTokTaskHandler
   */
  async handleTiktokMessage(ctx: Context): Promise<void> {
    try {
      await this.tikTokTaskHandler.handleTiktokMessage(ctx);
    } catch (error) {
      logger.error('Error in TikTok message handling', error as Error);
    }
  }

  /**
   * Handle TikTok callback queries - delegate to TikTokTaskHandler
   */
  async handleTikTokCallback(ctx: Context): Promise<void> {
    try {
      await this.tikTokTaskHandler.handleTikTokCallback(ctx);
    } catch (error) {
      logger.error('Error in TikTok callback handling', error as Error);
    }
  }

  /**
   * Handle /start command - delegate to CommandHandler
   */
  async handleStartCommand(ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleStartCommand(ctx);
    } catch (error) {
      logger.error('Error in start command handling', error as Error);
    }
  }

  /**
   * Handle /classifica command - delegate to CommandHandler
   */
  async handleClassificaCommand(ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleClassificaCommand(ctx);
    } catch (error) {
      logger.error('Error in classifica command handling', error as Error);
    }
  }

  /**
   * Handle /help command - delegate to CommandHandler
   */
  async handleHelpCommand(ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleHelpCommand(ctx);
    } catch (error) {
      logger.error('Error in help command handling', error as Error);
    }
  }

  /**
   * Handle /link command - delegate to CommandHandler
   */
  async handleLinkCommand(ctx: Context): Promise<void> {
    try {
      await this.commandHandler.handleLinkCommand(ctx);
    } catch (error) {
      logger.error('Error in link command handling', error as Error);
    }
  }

  /**
   * Handle admin leaderboard generation - delegate to AdminCommandHandler
   */
  async handleGenerateClassificaCommand(ctx: Context): Promise<void> {
    try {
      await this.adminCommandHandler.handleGenerateClassificaCommand(ctx);
    } catch (error) {
      logger.error('Error in admin classifica generation', error as Error);
    }
  }

  /**
   * Handle admin health check - delegate to AdminCommandHandler
   */
  async handleHealthCommand(ctx: Context): Promise<void> {
    try {
      await this.adminCommandHandler.handleHealthCommand(ctx);
    } catch (error) {
      logger.error('Error in health command handling', error as Error);
    }
  }

  /**
   * Handle admin stats command - delegate to AdminCommandHandler
   */
  async handleStatsCommand(ctx: Context): Promise<void> {
    try {
      await this.adminCommandHandler.handleStatsCommand(ctx);
    } catch (error) {
      logger.error('Error in stats command handling', error as Error);
    }
  }

  /**
   * Handle admin cleanup command - delegate to AdminCommandHandler
   */
  async handleCleanupCommand(ctx: Context): Promise<void> {
    try {
      await this.adminCommandHandler.handleCleanupCommand(ctx);
    } catch (error) {
      logger.error('Error in cleanup command handling', error as Error);
    }
  }

  /**
   * Handle bot status changes - delegate to BotStatusHandler
   */
  async handleMyChatMember(ctx: Context): Promise<void> {
    try {
      await this.botStatusHandler.handleMyChatMember(ctx);
    } catch (error) {
      logger.error('Error in bot status handling', error as Error);
    }
  }

  /**
   * Get specific handlers for external access if needed
   */
  getJoinRequestHandler(): JoinRequestHandler {
    return this.joinRequestHandler;
  }

  getMemberLifecycleHandler(): MemberLifecycleHandler {
    return this.memberLifecycleHandler;
  }

  getCommandHandler(): CommandHandler {
    return this.commandHandler;
  }

  getTikTokTaskHandler(): TikTokTaskHandler {
    return this.tikTokTaskHandler;
  }

  getAdminCommandHandler(): AdminCommandHandler {
    return this.adminCommandHandler;
  }

  getBotStatusHandler(): BotStatusHandler {
    return this.botStatusHandler;
  }

  /**
   * Health check method for monitoring
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Perform basic health checks on all handlers
      // This could be extended to ping each handler's dependencies
      return true;
    } catch (error) {
      logger.error('Health check failed', error as Error);
      return false;
    }
  }

  /**
   * Graceful shutdown - cleanup handlers if needed
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('BotController shutting down...');
      // Perform any necessary cleanup for handlers
      // Most handlers are stateless, so minimal cleanup needed
      logger.info('BotController shutdown complete');
    } catch (error) {
      logger.error('Error during BotController shutdown', error as Error);
    }
  }
}