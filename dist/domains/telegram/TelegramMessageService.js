"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramMessageService = void 0;
const MessageService_1 = __importDefault(require("../../services/MessageService"));
const logger_1 = __importDefault(require("../../utils/logger"));
const cache_1 = __importDefault(require("../../utils/cache"));
const promises_1 = require("fs/promises");
const path_1 = require("path");
class TelegramMessageService {
    constructor(coreService) {
        this.coreService = coreService;
        logger_1.default.info('TelegramMessageService initialized');
    }
    escapeMarkdownSpecialChars(text) {
        text = text.replace(/@([a-zA-Z0-9_]+)/g, '\\@$1');
        text = text.replace(/_/g, '\\_');
        return text;
    }
    processMarkdownText(text) {
        return this.escapeMarkdownSpecialChars(text);
    }
    async sendWelcomeWithTikTok(userId, userName, referralLink) {
        try {
            const bot = this.coreService.getBot();
            const tiktokCallbackData = `tiktok_points:${userId}`;
            let messageText;
            try {
                messageText = await MessageService_1.default.loadMessage('welcome_with_tiktok', {
                    variables: {
                        userName,
                        referralLink
                    }
                });
            }
            catch (templateError) {
                logger_1.default.warn('Failed to load welcome template, using fallback', { userId, error: templateError });
                messageText = `🎉 Benvenuto ${userName}!\n\nCompleta il task TikTok per guadagnare punti e invita i tuoi amici!\n\n🔗 Il tuo link: ${referralLink}`;
            }
            try {
                const photoPath = (0, path_1.join)(process.cwd(), 'media', 'istruzioni.png');
                const photoBuffer = await (0, promises_1.readFile)(photoPath);
                await bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                    caption: messageText,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎵 Apri TikTok', url: await this.getTikTokUrl() }
                            ],
                            [
                                { text: '✅ Ho visitato TikTok', callback_data: tiktokCallbackData }
                            ]
                        ]
                    }
                });
                const welcomeTimestamp = Date.now();
                cache_1.default.set(`welcome_sent:${userId}`, welcomeTimestamp, 1800);
                logger_1.default.info('Welcome message with photo sent successfully', { userId, userName, welcomeTimestamp });
                return true;
            }
            catch (photoError) {
                logger_1.default.warn('Failed to send photo, sending text message instead', {
                    userId,
                    userName,
                    error: photoError
                });
                await bot.telegram.sendMessage(userId, messageText, {
                    parse_mode: 'Markdown',
                    link_preview_options: { is_disabled: true },
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎵 Apri TikTok', url: await this.getTikTokUrl() }
                            ],
                            [
                                { text: '✅ Ho visitato TikTok', callback_data: tiktokCallbackData }
                            ]
                        ]
                    }
                });
                const welcomeTimestamp = Date.now();
                cache_1.default.set(`welcome_sent:${userId}`, welcomeTimestamp, 1800);
                logger_1.default.info('Welcome text message sent successfully', { userId, userName, welcomeTimestamp });
                return true;
            }
        }
        catch (error) {
            logger_1.default.error('Failed to send welcome message with TikTok', error, {
                userId,
                userName,
                referralLink
            });
            return false;
        }
    }
    async sendWelcomeReturningUser(userId, userName, totalPoints, referralLink) {
        try {
            const bot = this.coreService.getBot();
            let messageText;
            try {
                messageText = await MessageService_1.default.loadMessage('welcome_returning_user', {
                    variables: {
                        userName,
                        totalPoints: totalPoints.toString(),
                        referralLink
                    }
                });
            }
            catch (templateError) {
                logger_1.default.warn('Failed to load returning user template, using fallback', { userId, error: templateError });
                messageText = `🎉 Bentornato ${userName}!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${referralLink}\n\nContinua a invitare amici per guadagnare altri punti!`;
            }
            await bot.telegram.sendMessage(userId, messageText, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true },
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '👥 Invita Amici', url: referralLink }
                        ]
                    ]
                }
            });
            logger_1.default.info('Returning user welcome message sent successfully', { userId, userName, totalPoints });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to send returning user welcome message', error, {
                userId,
                userName,
                totalPoints,
                referralLink
            });
            return false;
        }
    }
    async sendTikTokPointsMessage(userId, userName, totalPoints, referralLink) {
        try {
            const bot = this.coreService.getBot();
            let messageText;
            try {
                messageText = await MessageService_1.default.loadMessage('tiktok_points_earned', {
                    variables: {
                        userName,
                        totalPoints: totalPoints.toString(),
                        referralLink
                    }
                });
            }
            catch (templateError) {
                logger_1.default.warn('Failed to load TikTok success template, using fallback', { userId, error: templateError });
                messageText = `🎉 Complimenti ${userName}!\n\nHai completato il task TikTok: +3 punti!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${referralLink}\n\nContinua a invitare amici per guadagnare altri punti!`;
            }
            try {
                await bot.telegram.sendMessage(userId, messageText, {
                    parse_mode: 'Markdown',
                    link_preview_options: { is_disabled: true },
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '👥 Invita Amici', url: referralLink }
                            ]
                        ]
                    }
                });
            }
            catch (markdownError) {
                if (markdownError.message?.includes('parse entities')) {
                    logger_1.default.warn('Markdown parsing failed in TikTok success message, sending without formatting', {
                        userId,
                        error: markdownError.message
                    });
                    await bot.telegram.sendMessage(userId, messageText.replace(/[*_`\[\]()]/g, ''), {
                        link_preview_options: { is_disabled: true },
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '👥 Invita Amici', url: referralLink }
                                ]
                            ]
                        }
                    });
                }
                else {
                    throw markdownError;
                }
            }
            logger_1.default.info('TikTok points message sent successfully', { userId, userName, totalPoints });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to send TikTok points message', error, {
                userId,
                userName,
                totalPoints,
                referralLink
            });
            return false;
        }
    }
    async sendGoodbyeMessage(userId, userName, options) {
        logger_1.default.info('TelegramMessageService: Starting goodbye message send', {
            userId,
            userName,
            options,
            step: 'start'
        });
        try {
            const goodbyeText = await this.getGoodbyeMessage(userName, options);
            logger_1.default.info('TelegramMessageService: Goodbye message text prepared', {
                userId,
                userName,
                messageLength: goodbyeText.length,
                messagePreview: goodbyeText.substring(0, 100) + '...',
                step: 'text_prepared'
            });
            const bot = this.coreService.getBot();
            logger_1.default.info('TelegramMessageService: About to send message via Telegram API', {
                userId,
                userName,
                step: 'before_api_call'
            });
            await bot.telegram.sendMessage(userId, goodbyeText, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true }
            });
            logger_1.default.info('TelegramMessageService: Goodbye message sent successfully via API', {
                userId,
                userName,
                step: 'api_success'
            });
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorCode = error?.code || 'unknown';
            logger_1.default.error('TelegramMessageService: Failed to send goodbye message', error, {
                userId,
                userName,
                errorMessage,
                errorCode,
                errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                step: 'api_error'
            });
            if (errorMessage.includes('blocked') || errorMessage.includes('Forbidden')) {
                logger_1.default.warn('TelegramMessageService: User has blocked the bot or privacy settings prevent message', {
                    userId,
                    userName,
                    errorMessage
                });
            }
            else if (errorMessage.includes('not found') || errorMessage.includes('chat not found')) {
                logger_1.default.warn('TelegramMessageService: Chat not found - user may have deleted account', {
                    userId,
                    userName,
                    errorMessage
                });
            }
            return false;
        }
    }
    async getGoodbyeMessage(userName, options) {
        try {
            return await MessageService_1.default.loadMessage('goodbye', {
                variables: {
                    userName,
                    includeReturnMessage: options?.includeReturnMessage ? 'true' : 'false'
                }
            });
        }
        catch (templateError) {
            logger_1.default.warn('Failed to load goodbye template, using fallback', { userName, error: templateError });
            let message = `👋 Ciao ${userName}!\n\nCi dispiace vederti andare.`;
            if (options?.includeReturnMessage) {
                message += `\n\n🔄 *Potrai sempre tornare quando vuoi!*\nIl canale ti aspetta.`;
            }
            return message;
        }
    }
    async sendPhoto(chatId, photoPath, caption, options) {
        try {
            const bot = this.coreService.getBot();
            const photoBuffer = await (0, promises_1.readFile)(photoPath);
            await bot.telegram.sendPhoto(chatId, { source: photoBuffer }, {
                caption,
                ...options
            });
            logger_1.default.info('Photo sent successfully', { chatId, photoPath });
            return true;
        }
        catch (error) {
            logger_1.default.warn('Failed to send photo, attempting text fallback', {
                chatId,
                photoPath,
                error
            });
            if (caption) {
                try {
                    const bot = this.coreService.getBot();
                    await bot.telegram.sendMessage(chatId, caption, options);
                    logger_1.default.info('Text fallback sent successfully', { chatId });
                    return true;
                }
                catch (textError) {
                    logger_1.default.error('Text fallback also failed', textError, { chatId });
                }
            }
            return false;
        }
    }
    async getTikTokUrl() {
        try {
            return await MessageService_1.default.getSetting('TIKTOK_URL', 'https://www.tiktok.com/@lo_sbloccatore');
        }
        catch (error) {
            logger_1.default.warn('Failed to get TikTok URL from settings, using default');
            return 'https://www.tiktok.com/@lo_sbloccatore';
        }
    }
}
exports.TelegramMessageService = TelegramMessageService;
//# sourceMappingURL=TelegramMessageService.js.map