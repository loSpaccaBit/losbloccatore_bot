"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramCoreService = void 0;
const telegraf_1 = require("telegraf");
const config_1 = __importDefault(require("../../config"));
const logger_1 = __importDefault(require("../../utils/logger"));
class TelegramCoreService {
    constructor() {
        this.isPolling = false;
        this.bot = new telegraf_1.Telegraf(config_1.default.token);
        this.setupErrorHandling();
        logger_1.default.info('TelegramCoreService initialized');
    }
    setupErrorHandling() {
        this.bot.catch((err, ctx) => {
            logger_1.default.error('Telegram bot error occurred', err, {
                updateId: ctx.update?.update_id,
                updateType: ctx.updateType,
                chatId: ctx.chat?.id,
                userId: ctx.from?.id
            });
        });
    }
    getBot() {
        return this.bot;
    }
    async startPolling() {
        if (this.isPolling) {
            logger_1.default.warn('Bot is already polling');
            return;
        }
        try {
            const allowedUpdates = [
                'message',
                'edited_message',
                'channel_post',
                'edited_channel_post',
                'inline_query',
                'chosen_inline_result',
                'callback_query',
                'shipping_query',
                'pre_checkout_query',
                'poll',
                'poll_answer',
                'my_chat_member',
                'chat_member',
                'chat_join_request'
            ];
            logger_1.default.info('Starting bot polling with allowed updates', {
                allowedUpdates,
                totalUpdates: allowedUpdates.length
            });
            await this.bot.launch({
                allowedUpdates: allowedUpdates
            });
            this.isPolling = true;
            logger_1.default.info('✅ Bot polling started successfully with chat_member updates enabled');
        }
        catch (error) {
            logger_1.default.error('❌ Failed to start bot polling', error);
            throw error;
        }
    }
    async stop() {
        if (!this.isPolling) {
            logger_1.default.warn('Bot is not currently polling');
            return;
        }
        try {
            await this.bot.stop();
            this.isPolling = false;
            logger_1.default.info('✅ Bot polling stopped gracefully');
        }
        catch (error) {
            logger_1.default.error('❌ Error stopping bot', error);
            throw error;
        }
    }
    isCurrentlyPolling() {
        return this.isPolling;
    }
    async getBotInfo() {
        try {
            return await this.bot.telegram.getMe();
        }
        catch (error) {
            logger_1.default.error('Failed to get bot info', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            await this.bot.telegram.getMe();
            return true;
        }
        catch (error) {
            logger_1.default.error('Bot health check failed', error);
            return false;
        }
    }
}
exports.TelegramCoreService = TelegramCoreService;
//# sourceMappingURL=TelegramCoreService.js.map