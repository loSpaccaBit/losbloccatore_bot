"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BotController_1 = require("./controllers/BotController");
const ErrorHandler_1 = require("./middleware/ErrorHandler");
const LoggingMiddleware_1 = require("./middleware/LoggingMiddleware");
const TikTokTrackingMiddleware_1 = require("./middleware/TikTokTrackingMiddleware");
const DIContainer_1 = __importDefault(require("./core/DIContainer"));
const connection_1 = __importDefault(require("./database/connection"));
const index_1 = __importDefault(require("./config/index"));
const logger_1 = __importDefault(require("./utils/logger"));
const LeaderboardSchedulerService_1 = __importDefault(require("./services/LeaderboardSchedulerService"));
class Application {
    constructor() {
        this.botController = null;
    }
    async initialize() {
        try {
            logger_1.default.info('🚀 Starting LosBloccatore Bot v2.0.0 - Refactored Architecture', {
                environment: index_1.default.environment,
                channelId: index_1.default.channelId,
                nodeVersion: process.version
            });
            logger_1.default.info('📊 Initializing database connection...');
            await connection_1.default.initialize();
            logger_1.default.info('✅ Database connection established');
            logger_1.default.info('🔧 Initializing dependency injection container...');
            const services = DIContainer_1.default.initialize();
            logger_1.default.info('✅ DI Container initialized with all services');
            logger_1.default.info('🎮 Initializing refactored bot controller...');
            this.botController = new BotController_1.BotController(services);
            logger_1.default.info('✅ Bot controller initialized with all handlers');
            logger_1.default.info('🤖 Setting up Telegram bot...');
            const telegramService = services.telegramService;
            const bot = telegramService.getBot();
            bot.use(LoggingMiddleware_1.LoggingMiddleware.createRequestLoggingMiddleware());
            bot.use(TikTokTrackingMiddleware_1.TikTokTrackingMiddleware.createTikTokTrackingMiddleware());
            bot.use(LoggingMiddleware_1.LoggingMiddleware.createPerformanceLoggingMiddleware(2000));
            bot.use(TikTokTrackingMiddleware_1.TikTokTrackingMiddleware.createTikTokInteractionMiddleware());
            bot.use(LoggingMiddleware_1.LoggingMiddleware.createSecurityLoggingMiddleware());
            bot.use(ErrorHandler_1.ErrorHandler.createRateLimitMiddleware(30, 60));
            bot.use(ErrorHandler_1.ErrorHandler.createValidationMiddleware());
            bot.use(ErrorHandler_1.ErrorHandler.createTelegramMiddleware());
            if (index_1.default.environment === 'development') {
                bot.use(LoggingMiddleware_1.LoggingMiddleware.createDetailedLoggingMiddleware());
            }
            this.setupBotHandlers(bot);
            logger_1.default.info('📡 Starting bot polling...');
            await telegramService.startPolling();
            logger_1.default.info('📊 Starting leaderboard scheduler...');
            LeaderboardSchedulerService_1.default.start();
            await this.checkBotPermissions(services.telegramService);
            logger_1.default.info('🎉 Bot started successfully', {
                timestamp: new Date().toISOString(),
                process: process.pid,
                leaderboardScheduler: LeaderboardSchedulerService_1.default.getStatus()
            });
        }
        catch (error) {
            logger_1.default.error('❌ Failed to initialize application', error);
            await this.shutdown();
            process.exit(1);
        }
    }
    setupBotHandlers(bot) {
        bot.on('chat_join_request', async (ctx) => {
            if (this.botController) {
                await this.botController.handleChatJoinRequest(ctx);
            }
        });
        bot.on('chat_member', async (ctx) => {
            logger_1.default.info('🔍 chat_member event received', {
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
        bot.on('my_chat_member', async (ctx) => {
            if (this.botController) {
                await this.botController.handleMyChatMember(ctx);
            }
        });
        bot.on('left_chat_member', async (ctx) => {
            logger_1.default.info('🔍 left_chat_member event received', {
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
        bot.start(async (ctx) => {
            if (this.botController) {
                await this.botController.handleStartCommand(ctx);
            }
        });
        bot.command('classifica', async (ctx) => {
            if (this.botController) {
                await this.botController.handleClassificaCommand(ctx);
            }
        });
        bot.command('help', async (ctx) => {
            if (this.botController) {
                await this.botController.handleHelpCommand(ctx);
            }
        });
        bot.command('link', async (ctx) => {
            if (this.botController) {
                await this.botController.handleLinkCommand(ctx);
            }
        });
        bot.command('genera_classifica', async (ctx) => {
            if (this.botController) {
                await this.botController.handleGenerateClassificaCommand(ctx);
            }
        });
        bot.on('text', async (ctx) => {
            if (this.botController) {
                await this.botController.handleTiktokMessage(ctx);
            }
        });
        bot.on('callback_query', async (ctx) => {
            if (this.botController) {
                await this.botController.handleTikTokCallback(ctx);
            }
        });
        logger_1.default.info('✅ Bot event handlers configured');
    }
    async checkBotPermissions(telegramService) {
        try {
            const bot = telegramService.getBot();
            const channelId = parseInt(index_1.default.channelId);
            logger_1.default.info('🔍 Checking bot permissions in channel', {
                channelId,
                channelIdString: index_1.default.channelId
            });
            const botInfo = await bot.telegram.getMe();
            logger_1.default.info('Bot information', {
                botId: botInfo.id,
                botUsername: botInfo.username,
                botName: botInfo.first_name
            });
            try {
                const botMember = await bot.telegram.getChatMember(channelId, botInfo.id);
                logger_1.default.info('Bot permissions in channel', {
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
                    logger_1.default.warn('⚠️ Bot is not an administrator in the channel - chat_member events may not be received', {
                        channelId,
                        currentStatus: botMember.status,
                        recommendation: 'Make the bot an administrator to receive leave events'
                    });
                }
                else {
                    logger_1.default.info('✅ Bot has administrator privileges - should receive chat_member events');
                }
            }
            catch (permissionError) {
                logger_1.default.error('❌ Failed to check bot permissions in channel', permissionError, {
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
        }
        catch (error) {
            logger_1.default.error('❌ Error during bot permissions check', error);
        }
    }
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            logger_1.default.info(`🛑 Received ${signal} - Starting graceful shutdown...`);
            await this.shutdown();
            process.exit(0);
        };
        process.once('SIGINT', () => gracefulShutdown('SIGINT'));
        process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.once('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
    }
    async shutdown() {
        try {
            logger_1.default.info('🔄 Shutting down application...');
            if (LeaderboardSchedulerService_1.default.isActive()) {
                LeaderboardSchedulerService_1.default.stop();
                logger_1.default.info('✅ Leaderboard scheduler stopped');
            }
            if (this.botController) {
                const services = DIContainer_1.default.getServices();
                await services.telegramService.stop();
                logger_1.default.info('✅ Telegram bot stopped');
            }
            await connection_1.default.close();
            logger_1.default.info('✅ Database connection closed');
            logger_1.default.info('✅ Application shutdown completed');
        }
        catch (error) {
            logger_1.default.error('❌ Error during shutdown', error);
        }
    }
    async start() {
        this.setupGracefulShutdown();
        await this.initialize();
    }
}
const app = new Application();
app.start().catch((error) => {
    logger_1.default.error('❌ Failed to start application', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map