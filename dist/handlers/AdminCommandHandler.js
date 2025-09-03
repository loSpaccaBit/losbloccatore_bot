"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCommandHandler = void 0;
const LeaderboardSchedulerService_1 = __importDefault(require("../services/LeaderboardSchedulerService"));
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
class AdminCommandHandler {
    constructor(userActivityService) {
        this.userActivityService = userActivityService;
    }
    async handleGenerateClassificaCommand(ctx) {
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
            await LeaderboardSchedulerService_1.default.sendLeaderboardNow();
            await ctx.reply('✅ Classifica generata e inviata in privato!');
            logger_1.default.info('Manual leaderboard generation triggered by admin', {
                adminUserId: userId
            });
        }
        catch (error) {
            await this.handleAdminCommandError(ctx, error, 'generate_classifica', userId);
        }
    }
    async handleHealthCommand(ctx) {
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
            const healthInfo = await this.getSystemHealthInfo();
            const healthMessage = this.formatHealthMessage(healthInfo);
            await ctx.reply(healthMessage, { parse_mode: 'Markdown' });
            logger_1.default.info('Health check requested by admin', { adminUserId: userId });
        }
        catch (error) {
            await this.handleAdminCommandError(ctx, error, 'health', userId);
        }
    }
    async handleStatsCommand(ctx) {
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
            const stats = await this.getSystemStats();
            const statsMessage = this.formatStatsMessage(stats);
            await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
            logger_1.default.info('System stats requested by admin', { adminUserId: userId });
        }
        catch (error) {
            await this.handleAdminCommandError(ctx, error, 'stats', userId);
        }
    }
    async handleCleanupCommand(ctx) {
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
            const cleanupResults = await this.performDataCleanup();
            const cleanupMessage = `✅ *Pulizia completata*\n\n${this.formatCleanupResults(cleanupResults)}`;
            await ctx.reply(cleanupMessage, { parse_mode: 'Markdown' });
            logger_1.default.info('Data cleanup performed by admin', {
                adminUserId: userId,
                results: cleanupResults
            });
        }
        catch (error) {
            await this.handleAdminCommandError(ctx, error, 'cleanup', userId);
        }
    }
    async getSystemHealthInfo() {
        const startTime = Date.now();
        try {
            const dbHealth = await this.testDatabaseConnection();
            const responseTime = Date.now() - startTime;
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();
            return {
                status: 'healthy',
                database: dbHealth,
                responseTime,
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024),
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                },
                uptime: Math.round(uptime / 60),
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            };
        }
    }
    async testDatabaseConnection() {
        const startTime = Date.now();
        try {
            await this.userActivityService.getActivityCount();
            return {
                status: 'connected',
                responseTime: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                status: 'error',
                responseTime: Date.now() - startTime
            };
        }
    }
    async getSystemStats() {
        try {
            const totalActivities = await this.userActivityService.getActivityCount();
            const recentActivities = await this.userActivityService.getRecentActivityCount(24);
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
                    uptime: Math.round(uptime / 3600 * 100) / 100
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            throw new Error(`Failed to gather system stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async performDataCleanup() {
        try {
            const cleanupDate = new Date();
            cleanupDate.setDate(cleanupDate.getDate() - 90);
            const deletedRecords = await this.userActivityService.cleanupOldRecords(cleanupDate);
            return {
                deletedActivityRecords: deletedRecords,
                cleanupDate: cleanupDate.toISOString(),
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            throw new Error(`Data cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    formatHealthMessage(health) {
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
    formatStatsMessage(stats) {
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
    formatCleanupResults(results) {
        return `🗑️ **Records Deleted**: ${results.deletedActivityRecords}\n` +
            `📅 **Cutoff Date**: ${new Date(results.cleanupDate).toLocaleDateString()}\n` +
            `⏰ **Completed**: ${new Date(results.timestamp).toLocaleString()}`;
    }
    isAdmin(userId) {
        return config_1.default.adminUserId !== undefined && config_1.default.adminUserId === userId;
    }
    async handleAdminCommandError(ctx, error, command, userId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await ctx.reply(`❌ Errore durante l'esecuzione del comando ${command}.`);
        logger_1.default.error(`Admin command ${command} failed`, error, {
            adminUserId: userId,
            command,
            errorMessage
        });
    }
}
exports.AdminCommandHandler = AdminCommandHandler;
//# sourceMappingURL=AdminCommandHandler.js.map