"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCommandHandler = void 0;
const LeaderboardImageService_1 = require("../services/LeaderboardImageService");
const TelegramService_1 = require("../services/TelegramService");
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
class AdminCommandHandler {
    constructor(userActivityService, contestService) {
        this.userActivityService = userActivityService;
        this.contestService = contestService;
        this.leaderboardImageService = null;
        this.telegramService = null;
    }
    getLeaderboardImageService() {
        if (!this.leaderboardImageService) {
            this.leaderboardImageService = new LeaderboardImageService_1.LeaderboardImageService();
        }
        return this.leaderboardImageService;
    }
    getTelegramService() {
        if (!this.telegramService) {
            this.telegramService = new TelegramService_1.TelegramService();
        }
        return this.telegramService;
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
            const chatId = Number(config_1.default.channelId);
            const imagePath = await this.getLeaderboardImageService().generateLeaderboardImage(chatId);
            const leaderboardData = await this.getLeaderboardImageService().getLeaderboardData(chatId, 5);
            let messageText;
            if (leaderboardData.length === 0) {
                messageText = `🏆 *CLASSIFICA TOP 5*\n\n🚫 Nessun partecipante`;
            }
            else {
                messageText = `🏆 *CLASSIFICA TOP 5*\n\n`;
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                leaderboardData.forEach((participant, index) => {
                    messageText += `${medals[index]} ${participant.username} - ${participant.points} punti\n`;
                });
            }
            await this.getTelegramService().sendPhoto(userId, imagePath, messageText);
            await ctx.reply('✅ Classifica generata e inviata in privato!');
            logger_1.default.info('Manual leaderboard generation sent to requesting admin', {
                adminUserId: userId,
                chatId,
                participantCount: leaderboardData.length,
                imagePath
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
    async handleContestCommand(ctx) {
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
            const contestStats = await this.getContestStats();
            const contestMessage = this.formatContestMessage(contestStats);
            await ctx.reply(contestMessage, { parse_mode: 'Markdown' });
            logger_1.default.info('Contest stats requested by admin', { adminUserId: userId });
        }
        catch (error) {
            await this.handleAdminCommandError(ctx, error, 'contest', userId);
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
    async handleMessageCommand(ctx) {
        if (!('message' in ctx.update)) {
            return;
        }
        const message = ctx.update.message;
        const userId = message.from?.id;
        if (!userId || !this.isAdmin(userId)) {
            await ctx.reply('❌ Comando disponibile solo per gli amministratori.');
            return;
        }
        if (!('text' in message)) {
            await ctx.reply('❌ Comando deve essere inviato come messaggio di testo.');
            return;
        }
        const messageText = message.text;
        if (!messageText) {
            await ctx.reply('❌ Testo del messaggio non trovato.');
            return;
        }
        const args = messageText.split(' ');
        let targetUserId;
        try {
            if (args.length < 3) {
                await ctx.reply('❌ *Uso corretto:*\n`/message <user_id> <messaggio>`\n\nEsempio: `/message 123456789 Ciao! Questo è un messaggio dall\'admin.`', { parse_mode: 'Markdown' });
                return;
            }
            targetUserId = parseInt(args[1]);
            if (isNaN(targetUserId)) {
                await ctx.reply('❌ ID utente non valido. Deve essere un numero.');
                return;
            }
            const messageToSend = args.slice(2).join(' ');
            if (messageToSend.trim().length === 0) {
                await ctx.reply('❌ Il messaggio non può essere vuoto.');
                return;
            }
            if (messageToSend.length > 4096) {
                await ctx.reply('❌ Il messaggio è troppo lungo. Massimo 4096 caratteri.');
                return;
            }
            await ctx.reply('🔄 Invio del messaggio in corso...');
            const telegramService = this.getTelegramService();
            const bot = telegramService.getBot();
            await bot.telegram.sendMessage(targetUserId, messageToSend, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true }
            });
            await ctx.reply(`✅ *Messaggio inviato con successo*\n\n👤 **Destinatario:** ${targetUserId}\n📝 **Messaggio:** ${messageToSend.substring(0, 100)}${messageToSend.length > 100 ? '...' : ''}`, { parse_mode: 'Markdown' });
            logger_1.default.info('Admin message sent successfully', {
                adminUserId: userId,
                targetUserId,
                messagePreview: messageToSend.substring(0, 100),
                messageLength: messageToSend.length
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            let userFeedback = '❌ Errore durante l\'invio del messaggio.';
            if (errorMessage.includes('blocked') || errorMessage.includes('Forbidden')) {
                userFeedback = '❌ *Impossibile inviare il messaggio*\n\n🚫 L\'utente ha bloccato il bot o le sue impostazioni di privacy impediscono la ricezione di messaggi.';
            }
            else if (errorMessage.includes('not found') || errorMessage.includes('chat not found')) {
                userFeedback = '❌ *Utente non trovato*\n\nL\'ID utente specificato non esiste o l\'utente ha eliminato il proprio account.';
            }
            else if (errorMessage.includes('Bad Request')) {
                userFeedback = '❌ *Richiesta non valida*\n\nVerifica che l\'ID utente sia corretto e che il messaggio non contenga caratteri non supportati.';
            }
            else if (errorMessage.includes('Too Many Requests')) {
                userFeedback = '❌ *Troppe richieste*\n\nIl bot ha raggiunto i limiti di velocità di Telegram. Riprova tra qualche minuto.';
            }
            await ctx.reply(userFeedback, { parse_mode: 'Markdown' });
            logger_1.default.error('Failed to send admin message', error, {
                adminUserId: userId,
                targetUserId: targetUserId || 'unknown',
                errorDetails: errorMessage,
                errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                commandText: messageText?.substring(0, 100)
            });
        }
    }
    async getContestStats() {
        try {
            const chatId = Number(config_1.default.channelId);
            const allParticipants = await this.contestService['prisma'].contestParticipant.findMany({
                where: {
                    chatId: BigInt(chatId),
                    isActive: true
                }
            });
            const inactiveParticipants = await this.contestService['prisma'].contestParticipant.count({
                where: {
                    chatId: BigInt(chatId),
                    isActive: false
                }
            });
            const totalActiveParticipants = allParticipants.length;
            const participantsWithPoints = allParticipants.filter(p => p.points > 0).length;
            const participantsWithReferrals = allParticipants.filter(p => p.referralCount > 0).length;
            const tiktokTasksCompleted = allParticipants.filter(p => p.tiktokTaskCompleted).length;
            const totalPoints = allParticipants.reduce((sum, p) => sum + p.points, 0);
            const averagePoints = totalActiveParticipants > 0 ? Math.round(totalPoints / totalActiveParticipants * 100) / 100 : 0;
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
            const topParticipants = await this.contestService.getLeaderboard(chatId, 5);
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
        }
        catch (error) {
            throw new Error(`Failed to gather contest stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    formatContestMessage(stats) {
        let message = `🏆 *Contest Statistics*\n\n`;
        message += `👥 **Participants:**\n`;
        message += `• Active: ${stats.totalActiveParticipants}\n`;
        message += `• Inactive: ${stats.inactiveParticipants}\n`;
        message += `• Recent (24h): ${stats.recentParticipants}\n`;
        message += `• With Points: ${stats.participantsWithPoints}\n\n`;
        message += `🎯 **Points:**\n`;
        message += `• Total Points: ${stats.totalPoints}\n`;
        message += `• Average Points: ${stats.averagePoints}\n\n`;
        message += `📱 **Tasks:**\n`;
        message += `• TikTok Completed: ${stats.tiktokTasksCompleted}/${stats.totalActiveParticipants}\n`;
        message += `• Completion Rate: ${stats.totalActiveParticipants > 0 ? Math.round(stats.tiktokTasksCompleted / stats.totalActiveParticipants * 100) : 0}%\n\n`;
        message += `🤝 **Referrals:**\n`;
        message += `• Users with Referrals: ${stats.participantsWithReferrals}\n`;
        message += `• Total Referral Links: ${stats.totalReferrals}\n`;
        message += `• Active Referrals: ${stats.activeReferrals}\n\n`;
        if (stats.topParticipants && stats.topParticipants.length > 0) {
            message += `🥇 **Top 5 Participants:**\n`;
            stats.topParticipants.forEach((participant, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                const name = participant.firstName + (participant.lastName ? ` ${participant.lastName}` : '');
                message += `${medal} ${name} - ${participant.points} punti\n`;
            });
            message += `\n`;
        }
        message += `📅 Generated: ${new Date(stats.timestamp).toLocaleString()}`;
        return message;
    }
    isAdmin(userId) {
        if (config_1.default.adminUserIds && config_1.default.adminUserIds.length > 0) {
            return config_1.default.adminUserIds.includes(userId);
        }
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