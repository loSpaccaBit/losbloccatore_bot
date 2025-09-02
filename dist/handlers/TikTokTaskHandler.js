"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokTaskHandler = void 0;
const MessageService_1 = __importDefault(require("../services/MessageService"));
const cache_1 = __importDefault(require("../utils/cache"));
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
class TikTokTaskHandler {
    constructor(telegramService, contestService) {
        this.telegramService = telegramService;
        this.contestService = contestService;
    }
    async handleTiktokMessage(ctx) {
        if (!('message' in ctx.update) || !('text' in ctx.update.message)) {
            return;
        }
        const message = ctx.update.message;
        const userId = message.from?.id;
        const text = message.text;
        if (!userId || !text) {
            return;
        }
        if (text.startsWith('/')) {
            return;
        }
        logger_1.default.debug('TikTok message ignored - direct link submission disabled', {
            userId,
            messageText: text.substring(0, 50) + '...'
        });
        return;
    }
    async handleTikTokCallback(ctx) {
        if (!('callback_query' in ctx.update)) {
            return;
        }
        const callbackQuery = ctx.update.callback_query;
        if (!('data' in callbackQuery) || !callbackQuery.data) {
            return;
        }
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;
        const userName = callbackQuery.from.first_name || 'User';
        try {
            if (data.startsWith('tiktok_points:')) {
                await this.processTikTokPointsCallback(ctx, data, userId, userName);
            }
        }
        catch (error) {
            await this.handleTikTokCallbackError(ctx, error, userId, userName, data);
        }
    }
    async processTikTokPointsCallback(ctx, data, userId, userName) {
        const callbackQuery = ctx.update.callback_query;
        const targetUserId = parseInt(data.split(':')[1]);
        if (userId !== targetUserId) {
            const errorMessage = await MessageService_1.default.loadMessage('tiktok_button_not_for_you').catch(() => '❌ Questo pulsante non è per te!');
            await ctx.answerCbQuery(errorMessage, { show_alert: true });
            return;
        }
        if (!(await this.isTimingRequirementMet(ctx, userId))) {
            return;
        }
        const participant = await this.contestService.getOrCreateParticipant(userId, parseInt(config_1.default.channelId), userName, callbackQuery.from.last_name, callbackQuery.from.username);
        if (participant.tiktokTaskCompleted) {
            const completedMessage = await MessageService_1.default.loadMessage('tiktok_already_completed').catch(() => '✅ Hai già completato il task TikTok!');
            await ctx.answerCbQuery(completedMessage, { show_alert: true });
            return;
        }
        await this.completeTikTokTask(ctx, userId, userName, participant);
    }
    async isTimingRequirementMet(ctx, userId) {
        const welcomeTime = cache_1.default.get(`welcome_sent:${userId}`);
        logger_1.default.debug('Checking TikTok timing requirement', {
            userId,
            welcomeTime,
            currentTime: Date.now(),
            timeSinceWelcome: welcomeTime ? Date.now() - welcomeTime : 'no_welcome_time'
        });
        if (!welcomeTime || Date.now() - welcomeTime < 30000) {
            const waitMessage = await MessageService_1.default.loadMessage('tiktok_wait_required')
                .catch(() => '⚠️ Devi prima cliccare "Apri TikTok", visitare la pagina e seguire/commentare! Attendi almeno 30 secondi.');
            await ctx.answerCbQuery(waitMessage, { show_alert: true });
            logger_1.default.warn('TikTok timing requirement not met', {
                userId,
                welcomeTime,
                currentTime: Date.now(),
                timeSinceWelcome: welcomeTime ? Date.now() - welcomeTime : 'no_welcome_time'
            });
            return false;
        }
        logger_1.default.info('TikTok timing requirement met', {
            userId,
            timeSinceWelcome: Date.now() - welcomeTime
        });
        return true;
    }
    async completeTikTokTask(ctx, userId, userName, participant) {
        const tikTokSubmitted = await this.contestService.completeTiktokTaskViaButton(userId, parseInt(config_1.default.channelId));
        if (tikTokSubmitted) {
            logger_1.default.info('TikTok task completed successfully, preparing success message', {
                userId,
                userName
            });
            const updatedParticipant = await this.contestService.getParticipantStats(userId, parseInt(config_1.default.channelId));
            const totalPoints = updatedParticipant?.points || 0;
            await ctx.answerCbQuery('🎉 TikTok visitato! +3 punti!', { show_alert: false });
            await this.sendTikTokSuccessMessage(ctx, userId, userName, totalPoints, participant);
            logger_1.default.info('TikTok task completed via button click', {
                userId,
                userName,
                pointsAwarded: 3,
                totalPoints,
                tiktokTaskCompleted: true
            });
        }
        else {
            logger_1.default.warn('TikTok task completion failed', {
                userId,
                userName,
                reason: 'completeTiktokTaskViaButton returned false'
            });
            await ctx.answerCbQuery('❌ Errore nell\'assegnare i punti. Riprova!', { show_alert: true });
        }
    }
    async sendTikTokSuccessMessage(ctx, userId, userName, totalPoints, participant) {
        const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
        const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;
        logger_1.default.info('Sending TikTok success message using centralized template', {
            userId,
            userName,
            totalPoints,
            referralLink: finalReferralLink
        });
        const messageSuccessfullySent = await this.telegramService.sendTikTokPointsMessage(userId, userName, totalPoints, finalReferralLink);
        if (messageSuccessfullySent) {
            logger_1.default.info('TikTok success message sent successfully via centralized service', { userId, userName });
        }
        else {
            logger_1.default.warn('Failed to send TikTok message via service, sending fallback message', { userId, userName });
            await this.sendFallbackTikTokMessage(userId, totalPoints, finalReferralLink);
        }
    }
    async sendFallbackTikTokMessage(userId, totalPoints, referralLink) {
        const bot = this.telegramService.getBot();
        await bot.telegram.sendMessage(userId, `🎉 Complimenti! Hai completato il task TikTok: +3 punti!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${referralLink}`, { link_preview_options: { is_disabled: true } });
    }
    async handleTikTokCallbackError(ctx, error, userId, userName, data) {
        logger_1.default.error('Error handling TikTok callback', error, {
            userId,
            userName,
            callbackData: data
        });
        try {
            await ctx.answerCbQuery('❌ Errore durante l\'elaborazione. Riprova più tardi.', { show_alert: true });
        }
        catch (answerError) {
            logger_1.default.error('Failed to answer callback query', answerError, {
                originalError: error,
                userId,
                userName
            });
        }
    }
    async hasUserCompletedTikTokTask(userId) {
        try {
            const participant = await this.contestService.getParticipantStats(userId, parseInt(config_1.default.channelId));
            return participant?.tiktokTaskCompleted || false;
        }
        catch (error) {
            logger_1.default.error('Error checking TikTok task completion status', error, { userId });
            return false;
        }
    }
    async getTikTokTaskStats(userId) {
        try {
            const participant = await this.contestService.getParticipantStats(userId, parseInt(config_1.default.channelId));
            if (!participant) {
                return null;
            }
            return {
                completed: participant.tiktokTaskCompleted,
                pointsEarned: participant.tiktokTaskCompleted ? 3 : 0,
            };
        }
        catch (error) {
            logger_1.default.error('Error getting TikTok task stats', error, { userId });
            return null;
        }
    }
}
exports.TikTokTaskHandler = TikTokTaskHandler;
//# sourceMappingURL=TikTokTaskHandler.js.map