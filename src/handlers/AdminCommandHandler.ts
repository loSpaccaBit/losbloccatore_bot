import { Context } from 'telegraf';
import { UserActivityService } from '../services/UserActivityService';
import leaderboardScheduler from '../services/LeaderboardSchedulerService';
import config from '../config';
import logger from '../utils/logger';

/**
 * Handles administrative commands and operations
 * Restricted to authorized admin users only
 */
export class AdminCommandHandler {
  constructor(
    private userActivityService: UserActivityService
  ) {}

  /**
   * Handle manual leaderboard generation command
   */
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
      
      // Trigger manual leaderboard generation
      await leaderboardScheduler.sendLeaderboardNow();
      
      await ctx.reply('✅ Classifica generata e inviata in privato!');
      
      logger.info('Manual leaderboard generation triggered by admin', { 
        adminUserId: userId 
      });
      
    } catch (error) {
      await this.handleAdminCommandError(ctx, error, 'generate_classifica', userId);
    }
  }

  /**
   * Handle system health check command (admin only)
   */
  async handleHealthCommand(ctx: Context): Promise<void> {
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
      // Get system health information
      const healthInfo = await this.getSystemHealthInfo();
      
      const healthMessage = this.formatHealthMessage(healthInfo);
      
      await ctx.reply(healthMessage, { parse_mode: 'Markdown' });
      
      logger.info('Health check requested by admin', { adminUserId: userId });
      
    } catch (error) {
      await this.handleAdminCommandError(ctx, error, 'health', userId);
    }
  }

  /**
   * Handle system statistics command (admin only)
   */
  async handleStatsCommand(ctx: Context): Promise<void> {
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
      // Get system statistics
      const stats = await this.getSystemStats();
      
      const statsMessage = this.formatStatsMessage(stats);
      
      await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
      
      logger.info('System stats requested by admin', { adminUserId: userId });
      
    } catch (error) {
      await this.handleAdminCommandError(ctx, error, 'stats', userId);
    }
  }

  /**
   * Handle cleanup command to remove old records (admin only)
   */
  async handleCleanupCommand(ctx: Context): Promise<void> {
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
      await ctx.reply('🔄 Avviando pulizia dei dati vecchi...');
      
      // Perform cleanup operations
      const cleanupResults = await this.performDataCleanup();
      
      const cleanupMessage = `✅ *Pulizia completata*\n\n${this.formatCleanupResults(cleanupResults)}`;
      
      await ctx.reply(cleanupMessage, { parse_mode: 'Markdown' });
      
      logger.info('Data cleanup performed by admin', { 
        adminUserId: userId,
        results: cleanupResults 
      });
      
    } catch (error) {
      await this.handleAdminCommandError(ctx, error, 'cleanup', userId);
    }
  }

  /**
   * Get system health information
   */
  private async getSystemHealthInfo(): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Test database connection
      const dbHealth = await this.testDatabaseConnection();
      const responseTime = Date.now() - startTime;
      
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      
      // Get uptime
      const uptime = process.uptime();
      
      return {
        status: 'healthy',
        database: dbHealth,
        responseTime,
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        },
        uptime: Math.round(uptime / 60), // minutes
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test database connection health
   */
  private async testDatabaseConnection(): Promise<{status: string, responseTime: number}> {
    const startTime = Date.now();
    
    try {
      // Simple query to test database connectivity
      await this.userActivityService.getActivityCount();
      
      return {
        status: 'connected',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get system statistics
   */
  private async getSystemStats(): Promise<any> {
    try {
      // Get activity statistics from database
      const totalActivities = await this.userActivityService.getActivityCount();
      const recentActivities = await this.userActivityService.getRecentActivityCount(24); // Last 24 hours
      
      // Get system info
      const nodeVersion = process.version;
      const platform = process.platform;
      const uptime = process.uptime();
      
      return {
        database: {
          totalActivities,
          recentActivities
        },
        system: {
          nodeVersion,
          platform,
          uptime: Math.round(uptime / 3600 * 100) / 100 // hours with 2 decimals
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to gather system stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform data cleanup operations
   */
  private async performDataCleanup(): Promise<any> {
    try {
      // Clean up old activity records (older than 90 days)
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - 90);
      
      const deletedRecords = await this.userActivityService.cleanupOldRecords(cleanupDate);
      
      return {
        deletedActivityRecords: deletedRecords,
        cleanupDate: cleanupDate.toISOString(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Data cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format health information message
   */
  private formatHealthMessage(health: any): string {
    if (health.status === 'unhealthy') {
      return `🚨 *System Health: UNHEALTHY*\n\n❌ Error: ${health.error}\n🕒 Timestamp: ${health.timestamp}`;
    }

    return `✅ *System Health: HEALTHY*\n\n` +
           `🗄️ **Database**: ${health.database.status} (${health.database.responseTime}ms)\n` +
           `⚡ **Response Time**: ${health.responseTime}ms\n` +
           `💾 **Memory Usage**: ${health.memory.heapUsed}MB / ${health.memory.heapTotal}MB\n` +
           `📊 **RSS**: ${health.memory.rss}MB\n` +
           `🕒 **Uptime**: ${health.uptime} minutes\n` +
           `📅 **Timestamp**: ${health.timestamp}`;
  }

  /**
   * Format system statistics message
   */
  private formatStatsMessage(stats: any): string {
    return `📊 *System Statistics*\n\n` +
           `**Database:**\n` +
           `• Total Activities: ${stats.database.totalActivities}\n` +
           `• Recent (24h): ${stats.database.recentActivities}\n\n` +
           `**System:**\n` +
           `• Node.js: ${stats.system.nodeVersion}\n` +
           `• Platform: ${stats.system.platform}\n` +
           `• Uptime: ${stats.system.uptime} hours\n\n` +
           `📅 Generated: ${stats.timestamp}`;
  }

  /**
   * Format cleanup results message
   */
  private formatCleanupResults(results: any): string {
    return `🗑️ **Records Deleted**: ${results.deletedActivityRecords}\n` +
           `📅 **Cutoff Date**: ${new Date(results.cleanupDate).toLocaleDateString()}\n` +
           `⏰ **Completed**: ${new Date(results.timestamp).toLocaleString()}`;
  }

  /**
   * Check if user is an administrator
   */
  private isAdmin(userId: number): boolean {
    return config.adminUserId !== undefined && config.adminUserId === userId;
  }

  /**
   * Handle errors in admin commands
   */
  private async handleAdminCommandError(ctx: Context, error: unknown, command: string, userId: number): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await ctx.reply(`❌ Errore durante l'esecuzione del comando ${command}.`);
    
    logger.error(`Admin command ${command} failed`, error as Error, { 
      adminUserId: userId,
      command,
      errorMessage
    });
  }
}