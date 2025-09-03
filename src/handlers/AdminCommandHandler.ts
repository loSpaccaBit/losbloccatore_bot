import { Context } from 'telegraf';
import { UserActivityService } from '../services/UserActivityService';
import { ContestService } from '../services/ContestService';
import leaderboardScheduler from '../services/LeaderboardSchedulerService';
import config from '../config';
import logger from '../utils/logger';

/**
 * Handles administrative commands and operations
 * Restricted to authorized admin users only
 */
export class AdminCommandHandler {
  constructor(
    private userActivityService: UserActivityService,
    private contestService: ContestService
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
   * Handle contest status command (admin only)
   */
  async handleContestCommand(ctx: Context): Promise<void> {
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
      // Get contest statistics
      const contestStats = await this.getContestStats();
      
      const contestMessage = this.formatContestMessage(contestStats);
      
      await ctx.reply(contestMessage, { parse_mode: 'Markdown' });
      
      logger.info('Contest stats requested by admin', { adminUserId: userId });
      
    } catch (error) {
      await this.handleAdminCommandError(ctx, error, 'contest', userId);
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
   * Get contest statistics
   */
  private async getContestStats(): Promise<any> {
    try {
      // Get channel ID from config
      const chatId = Number(config.channelId);
      
      // Get total participants
      const allParticipants = await this.contestService['prisma'].contestParticipant.findMany({
        where: { 
          chatId: BigInt(chatId),
          isActive: true
        }
      });

      // Get inactive participants count
      const inactiveParticipants = await this.contestService['prisma'].contestParticipant.count({
        where: { 
          chatId: BigInt(chatId),
          isActive: false
        }
      });

      // Calculate various statistics
      const totalActiveParticipants = allParticipants.length;
      const participantsWithPoints = allParticipants.filter(p => p.points > 0).length;
      const participantsWithReferrals = allParticipants.filter(p => p.referralCount > 0).length;
      const tiktokTasksCompleted = allParticipants.filter(p => p.tiktokTaskCompleted).length;
      
      // Total points in the system
      const totalPoints = allParticipants.reduce((sum, p) => sum + p.points, 0);
      const averagePoints = totalActiveParticipants > 0 ? Math.round(totalPoints / totalActiveParticipants * 100) / 100 : 0;

      // Referral statistics
      const totalReferrals = await this.contestService['prisma'].contestReferral.count({
        where: { 
          chatId: BigInt(chatId)
        }
      });

      const activeReferrals = await this.contestService['prisma'].contestReferral.count({
        where: { 
          chatId: BigInt(chatId),
          status: 'ACTIVE'
        }
      });

      // Top participants
      const topParticipants = await this.contestService.getLeaderboard(chatId, 5);
      
      // Recent activity (last 24 hours)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const recentParticipants = await this.contestService['prisma'].contestParticipant.count({
        where: {
          chatId: BigInt(chatId),
          joinedAt: {
            gte: yesterday
          }
        }
      });

      return {
        totalActiveParticipants,
        inactiveParticipants,
        participantsWithPoints,
        participantsWithReferrals,
        tiktokTasksCompleted,
        totalPoints,
        averagePoints,
        totalReferrals,
        activeReferrals,
        topParticipants,
        recentParticipants,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to gather contest stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Format contest statistics message
   */
  private formatContestMessage(stats: any): string {
    let message = `🏆 *Contest Statistics*\n\n`;
    
    // Participants overview
    message += `👥 **Participants:**\n`;
    message += `• Active: ${stats.totalActiveParticipants}\n`;
    message += `• Inactive: ${stats.inactiveParticipants}\n`;
    message += `• Recent (24h): ${stats.recentParticipants}\n`;
    message += `• With Points: ${stats.participantsWithPoints}\n\n`;
    
    // Points statistics
    message += `🎯 **Points:**\n`;
    message += `• Total Points: ${stats.totalPoints}\n`;
    message += `• Average Points: ${stats.averagePoints}\n\n`;
    
    // Tasks completion
    message += `📱 **Tasks:**\n`;
    message += `• TikTok Completed: ${stats.tiktokTasksCompleted}/${stats.totalActiveParticipants}\n`;
    message += `• Completion Rate: ${stats.totalActiveParticipants > 0 ? Math.round(stats.tiktokTasksCompleted / stats.totalActiveParticipants * 100) : 0}%\n\n`;
    
    // Referral statistics
    message += `🤝 **Referrals:**\n`;
    message += `• Users with Referrals: ${stats.participantsWithReferrals}\n`;
    message += `• Total Referral Links: ${stats.totalReferrals}\n`;
    message += `• Active Referrals: ${stats.activeReferrals}\n\n`;
    
    // Top 5 participants
    if (stats.topParticipants && stats.topParticipants.length > 0) {
      message += `🥇 **Top 5 Participants:**\n`;
      stats.topParticipants.forEach((participant: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const name = participant.firstName + (participant.lastName ? ` ${participant.lastName}` : '');
        message += `${medal} ${name} - ${participant.points} punti\n`;
      });
      message += `\n`;
    }
    
    message += `📅 Generated: ${new Date(stats.timestamp).toLocaleString()}`;
    
    return message;
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