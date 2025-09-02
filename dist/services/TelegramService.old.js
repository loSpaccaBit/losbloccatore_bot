"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const telegraf_1 = require("telegraf");
const index_1 = __importDefault(require("../config/index"));
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importDefault(require("../utils/cache"));
const MessageService_1 = __importDefault(require("./MessageService"));
const promises_1 = require("fs/promises");
const path_1 = require("path");
class TelegramService {
    constructor() {
        this.bot = new telegraf_1.Telegraf(index_1.default.token);
        this.setupErrorHandling();
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
    escapeMarkdownSpecialChars(text) {
        text = text.replace(/@([a-zA-Z0-9_]+)/g, '\\@$1');
        text = text.replace(/_/g, '\\_');
        return text;
    }
    processMarkdownText(text) {
        return this.escapeMarkdownSpecialChars(text);
    }
    async sendWelcomeWithTikTok(userId, userName, referralLink) {
        if (cache_1.default.isWelcomeMessageSent(userId)) {
            logger_1.default.debug('TikTok welcome message already sent to user', { userId, userName });
            return true;
        }
        if (!cache_1.default.checkRateLimit(`welcome:${userId}`, 1, 300)) {
            logger_1.default.warn('TikTok welcome message rate limit exceeded', { userId, userName });
            return false;
        }
        try {
            const [tiktokUrl, welcomeImage] = await Promise.all([
                MessageService_1.default.getSetting('TIKTOK_URL', 'https://www.tiktok.com/@lo_sbloccatore'),
                MessageService_1.default.getSetting('WELCOME_IMAGE', 'istruzioni.png')
            ]);
            const variables = {
                userName,
                tiktokUrl,
                includeRules: true,
                welcomeImage: welcomeImage
            };
            if (referralLink) {
                variables.referralLink = referralLink;
            }
            const metadata = await MessageService_1.default.getMessageMetadata('welcome_with_tiktok', variables);
            const messageContent = await MessageService_1.default.loadMessage('welcome_with_tiktok', {
                variables
            });
            const inlineKeyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '🎵 Apri TikTok',
                                url: tiktokUrl
                            }
                        ],
                        [
                            {
                                text: '✅ Ho visitato TikTok - Guadagna 3 punti!',
                                callback_data: `tiktok_points:${userId}`
                            }
                        ]
                    ]
                }
            };
            const imagePath = metadata.IMAGE || welcomeImage;
            if (imagePath && imagePath.trim()) {
                try {
                    const photoFilePath = (0, path_1.join)(process.cwd(), 'media', imagePath.trim());
                    const photoBuffer = await (0, promises_1.readFile)(photoFilePath);
                    try {
                        await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                            caption: messageContent,
                            parse_mode: 'Markdown',
                            ...inlineKeyboard
                        });
                    }
                    catch (markdownError) {
                        if (markdownError.message?.includes('parse entities')) {
                            logger_1.default.warn('Markdown parsing failed in photo caption, sending without formatting', {
                                userId,
                                error: markdownError.message,
                                contentLength: messageContent.length
                            });
                            await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                                caption: messageContent.replace(/[*_`\[\]()]/g, ''),
                                ...inlineKeyboard
                            });
                        }
                        else {
                            throw markdownError;
                        }
                    }
                }
                catch (photoError) {
                    logger_1.default.warn('Failed to send photo, sending text only', {
                        userId,
                        imagePath,
                        error: photoError
                    });
                    try {
                        await this.bot.telegram.sendMessage(userId, messageContent, {
                            parse_mode: 'Markdown',
                            link_preview_options: { is_disabled: true },
                            ...inlineKeyboard
                        });
                    }
                    catch (markdownError) {
                        if (markdownError.message?.includes('parse entities')) {
                            logger_1.default.warn('Markdown parsing failed in text fallback, sending without formatting', {
                                userId,
                                error: markdownError.message
                            });
                            await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
                                link_preview_options: { is_disabled: true },
                                ...inlineKeyboard
                            });
                        }
                        else {
                            throw markdownError;
                        }
                    }
                }
            }
            else {
                try {
                    await this.bot.telegram.sendMessage(userId, messageContent, {
                        parse_mode: 'Markdown',
                        link_preview_options: { is_disabled: true },
                        ...inlineKeyboard
                    });
                }
                catch (markdownError) {
                    if (markdownError.message?.includes('parse entities')) {
                        logger_1.default.warn('Markdown parsing failed in main text send, sending without formatting', {
                            userId,
                            error: markdownError.message
                        });
                        await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
                            link_preview_options: { is_disabled: true },
                            ...inlineKeyboard
                        });
                    }
                    else {
                        throw markdownError;
                    }
                }
            }
            cache_1.default.cacheWelcomeMessageSent(userId);
            cache_1.default.set(`welcome_sent:${userId}`, Date.now(), 1800);
            logger_1.default.logMessageSent(userId, 'welcome_tiktok', true);
            return true;
        }
        catch (error) {
            logger_1.default.logMessageSent(userId, 'welcome_tiktok', false, error);
            return false;
        }
    }
    async sendWelcomeReturningUser(userId, userName, totalPoints, referralLink) {
        if (cache_1.default.isWelcomeMessageSent(userId)) {
            logger_1.default.debug('Welcome message already sent to returning user', { userId, userName });
            return true;
        }
        if (!cache_1.default.checkRateLimit(`welcome:${userId}`, 1, 300)) {
            logger_1.default.warn('Welcome message rate limit exceeded for returning user', { userId, userName });
            return false;
        }
        try {
            const welcomeImage = await MessageService_1.default.getSetting('WELCOME_IMAGE', 'istruzioni.png');
            const variables = {
                userName,
                totalPoints,
                welcomeImage: welcomeImage
            };
            if (referralLink) {
                variables.referralLink = referralLink;
            }
            const metadata = await MessageService_1.default.getMessageMetadata('welcome_returning_user', variables);
            const messageContent = await MessageService_1.default.loadMessage('welcome_returning_user', {
                variables
            });
            const imagePath = metadata.IMAGE || welcomeImage;
            if (imagePath && imagePath.trim()) {
                try {
                    const photoFilePath = (0, path_1.join)(process.cwd(), 'media', imagePath.trim());
                    const photoBuffer = await (0, promises_1.readFile)(photoFilePath);
                    try {
                        await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                            caption: messageContent,
                            parse_mode: 'Markdown'
                        });
                    }
                    catch (markdownError) {
                        if (markdownError.message?.includes('parse entities')) {
                            logger_1.default.warn('Markdown parsing failed in returning user photo message, sending without formatting', {
                                userId,
                                error: markdownError.message
                            });
                            await this.bot.telegram.sendPhoto(userId, { source: photoBuffer }, {
                                caption: messageContent.replace(/[*_`\[\]()]/g, '')
                            });
                        }
                        else {
                            throw markdownError;
                        }
                    }
                }
                catch (photoError) {
                    logger_1.default.warn('Failed to send photo in returning user message, sending text only', {
                        userId,
                        imagePath,
                        error: photoError.message
                    });
                    try {
                        await this.bot.telegram.sendMessage(userId, messageContent, {
                            parse_mode: 'Markdown',
                            link_preview_options: { is_disabled: true }
                        });
                    }
                    catch (markdownError) {
                        if (markdownError.message?.includes('parse entities')) {
                            logger_1.default.warn('Markdown parsing failed in returning user text fallback, sending without formatting', {
                                userId,
                                error: markdownError.message
                            });
                            await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
                                link_preview_options: { is_disabled: true }
                            });
                        }
                        else {
                            throw markdownError;
                        }
                    }
                }
            }
            else {
                try {
                    await this.bot.telegram.sendMessage(userId, messageContent, {
                        parse_mode: 'Markdown',
                        link_preview_options: { is_disabled: true }
                    });
                }
                catch (markdownError) {
                    if (markdownError.message?.includes('parse entities')) {
                        logger_1.default.warn('Markdown parsing failed in returning user main text send, sending without formatting', {
                            userId,
                            error: markdownError.message
                        });
                        await this.bot.telegram.sendMessage(userId, messageContent.replace(/[*_`\[\]()]/g, ''), {
                            link_preview_options: { is_disabled: true }
                        });
                    }
                    else {
                        throw markdownError;
                    }
                }
            }
            cache_1.default.cacheWelcomeMessageSent(userId);
            logger_1.default.logMessageSent(userId, 'welcome_returning_user', true);
            return true;
        }
        catch (error) {
            logger_1.default.logMessageSent(userId, 'welcome_returning_user', false, error);
            return false;
        }
    }
    async sendTikTokPointsMessage(userId, userName, totalPoints, referralLink) {
        if (!cache_1.default.checkRateLimit(`tiktok_points:${userId}`, 1, 60)) {
            logger_1.default.warn('TikTok points message rate limit exceeded', { userId, userName });
            return false;
        }
        try {
            const messageContent = await MessageService_1.default.loadMessage('tiktok_points_earned', {
                variables: {
                    userName,
                    totalPoints,
                    referralLink
                }
            });
            await this.bot.telegram.sendMessage(userId, messageContent, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true }
            });
            logger_1.default.logMessageSent(userId, 'tiktok_points', true);
            return true;
        }
        catch (error) {
            logger_1.default.logMessageSent(userId, 'tiktok_points', false, error);
            return false;
        }
    }
    async sendGoodbyeMessage(userId, userName, options = {}) {
        if (cache_1.default.isGoodbyeMessageSent(userId)) {
            logger_1.default.debug('Goodbye message already sent to user recently', { userId, userName });
            return true;
        }
        if (!cache_1.default.checkRateLimit(`goodbye:${userId}`, 1, 300)) {
            logger_1.default.warn('Goodbye message rate limit exceeded', { userId, userName });
            return false;
        }
        try {
            const goodbyeMessage = await this.getGoodbyeMessage(userName, options);
            await this.bot.telegram.sendMessage(userId, goodbyeMessage, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true }
            });
            cache_1.default.cacheGoodbyeMessageSent(userId);
            logger_1.default.logMessageSent(userId, 'goodbye', true);
            return true;
        }
        catch (error) {
            logger_1.default.logMessageSent(userId, 'goodbye', false, error);
            return false;
        }
    }
    async approveChatJoinRequest(chatId, userId) {
        try {
            await this.bot.telegram.approveChatJoinRequest(chatId, userId);
            logger_1.default.debug('Chat join request approved', { chatId, userId });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to approve chat join request', error, { chatId, userId });
            return false;
        }
    }
    async declineChatJoinRequest(chatId, userId) {
        try {
            await this.bot.telegram.declineChatJoinRequest(chatId, userId);
            logger_1.default.debug('Chat join request declined', { chatId, userId });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to decline chat join request', error, { chatId, userId });
            return false;
        }
    }
    async getChatMemberCount(chatId) {
        try {
            const count = await this.bot.telegram.getChatMembersCount(chatId);
            return count;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat member count', error, { chatId });
            return null;
        }
    }
    async getChatInfo(chatId) {
        try {
            const chat = await this.bot.telegram.getChat(chatId);
            return chat;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat info', error, { chatId });
            return null;
        }
    }
    async createChannelInviteLink(chatId, referralCode) {
        try {
            const inviteLink = await this.bot.telegram.createChatInviteLink(chatId, {
                name: `Referral: ${referralCode}`,
                creates_join_request: true,
                expire_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
            });
            logger_1.default.info('Channel invite link created successfully', {
                chatId,
                referralCode,
                inviteLink: inviteLink.invite_link,
                expiresAt: inviteLink.expire_date
            });
            return inviteLink.invite_link;
        }
        catch (error) {
            logger_1.default.error('Failed to create channel invite link', error, {
                chatId,
                referralCode
            });
            return null;
        }
    }
    async getReferralInviteLink(referralCode) {
        const chatId = parseInt(index_1.default.channelId);
        const cacheKey = `invite_link:${referralCode}`;
        const cachedLink = cache_1.default.get(cacheKey);
        if (cachedLink) {
            logger_1.default.debug('Using cached invite link', { referralCode, link: cachedLink });
            return cachedLink;
        }
        const inviteLink = await this.createChannelInviteLink(chatId, referralCode);
        if (inviteLink) {
            cache_1.default.set(cacheKey, inviteLink, 24 * 60 * 60);
            logger_1.default.info('New invite link cached', { referralCode, link: inviteLink });
        }
        return inviteLink;
    }
    async getGoodbyeMessage(userName, options) {
        const variables = {
            userName,
            customMessage: options.customMessage || '',
            includeReturnMessage: options.includeReturnMessage || false
        };
        return await MessageService_1.default.loadMessage('goodbye', { variables });
    }
    async sendPhoto(chatId, photoPath, caption) {
        try {
            const photoBuffer = await (0, promises_1.readFile)(photoPath);
            const options = {};
            if (caption) {
                options.caption = caption;
                options.parse_mode = 'Markdown';
            }
            await this.bot.telegram.sendPhoto(chatId, { source: photoBuffer }, options);
            logger_1.default.info('Photo sent successfully', { chatId, photoPath, hasCaption: !!caption });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to send photo', error, { chatId, photoPath });
            return false;
        }
    }
    getBot() {
        return this.bot;
    }
    async startPolling() {
        const allowedUpdates = [
            'chat_join_request',
            'message',
            'chat_member',
            'my_chat_member',
            'callback_query'
        ];
        try {
            await this.bot.launch({
                allowedUpdates
            });
            logger_1.default.info('Telegram bot started successfully', {
                allowedUpdates,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger_1.default.error('Failed to start Telegram bot', error);
            throw error;
        }
    }
    async stop() {
        try {
            this.bot.stop();
            logger_1.default.info('Telegram bot stopped successfully');
        }
        catch (error) {
            logger_1.default.error('Error stopping Telegram bot', error);
            throw error;
        }
    }
}
exports.TelegramService = TelegramService;
//# sourceMappingURL=TelegramService.old.js.map