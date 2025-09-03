"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandler = void 0;
const MessageService_1 = __importDefault(require("../services/MessageService"));
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
class CommandHandler {
    constructor(telegramService, contestService) {
        this.telegramService = telegramService;
        this.contestService = contestService;
    }
    async handleStartCommand(ctx) {
        if (!('message' in ctx.update) || !ctx.update.message.from) {
            return;
        }
        const message = ctx.update.message;
        const userId = message.from.id;
        const userName = message.from.first_name || 'User';
        const chatId = message.chat.id;
        try {
            const referralCode = this.extractReferralCodeFromStart(message);
            if (referralCode) {
                logger_1.default.info('Start command with referral', { userId, userName, referralCode });
            }
            else {
                logger_1.default.info('Start command without referral', { userId, userName });
            }
            const channelId = parseInt(config_1.default.channelId);
            const participant = await this.contestService.getOrCreateParticipant(userId, channelId, userName, message.from.last_name, message.from.username, referralCode);
            await this.sendStartCommandResponse(ctx, participant, userId, userName);
            logger_1.default.info('Start command processed successfully', {
                userId,
                userName,
                chatId,
                hadReferral: !!referralCode,
                totalPoints: participant.points
            });
        }
        catch (error) {
            await this.handleCommandError(ctx, error, 'start');
        }
    }
    async handleClassificaCommand(ctx) {
        if (!('message' in ctx.update)) {
            return;
        }
        const message = ctx.update.message;
        const userId = message.from?.id;
        const userName = message.from?.first_name || 'User';
        if (!userId) {
            return;
        }
        try {
            const channelId = parseInt(config_1.default.channelId);
            const participant = await this.contestService.getUserPersonalStats(userId, channelId);
            if (!participant) {
                await ctx.reply('❌ Non sei ancora registrato nel contest. Unisciti al canale per iniziare!');
                return;
            }
            if (!participant.isActive) {
                await ctx.reply('❌ Il tuo profilo non è attivo. Unisciti nuovamente al canale per partecipare!');
                return;
            }
            await this.sendPersonalStatistics(ctx, participant, userId, userName);
        }
        catch (error) {
            await this.handleCommandError(ctx, error, 'classifica');
        }
    }
    async handleHelpCommand(ctx) {
        if (!('message' in ctx.update)) {
            return;
        }
        const message = ctx.update.message;
        const userId = message.from?.id;
        const userName = message.from?.first_name || 'User';
        if (!userId) {
            return;
        }
        try {
            const helpMessage = await MessageService_1.default.loadMessage('help', {
                variables: {
                    userName
                }
            });
            await this.sendMarkdownMessage(ctx, helpMessage, 'help');
            logger_1.default.info('Help command processed successfully', {
                userId,
                userName
            });
        }
        catch (error) {
            await this.sendFallbackHelpMessage(ctx);
            logger_1.default.error('Error handling help command', error, {
                userId,
                userName
            });
        }
    }
    async handleLinkCommand(ctx) {
        if (!('message' in ctx.update)) {
            return;
        }
        const message = ctx.update.message;
        const userId = message.from?.id;
        const userName = message.from?.first_name || 'User';
        if (!userId) {
            return;
        }
        try {
            const channelId = parseInt(config_1.default.channelId);
            const participant = await this.contestService.getOrCreateParticipant(userId, channelId, userName, message.from?.last_name, message.from?.username);
            await this.sendReferralLinkInfo(ctx, participant, userId, userName);
            logger_1.default.info('Link command processed successfully', {
                userId,
                userName,
                referralCode: participant.referralCode,
                totalPoints: participant.points
            });
        }
        catch (error) {
            await this.handleCommandError(ctx, error, 'link');
        }
    }
    extractReferralCodeFromStart(message) {
        if ('text' in message && message.text) {
            const startPayload = message.text.split(' ')[1];
            if (startPayload && startPayload !== message.from.id.toString()) {
                return startPayload;
            }
        }
        return undefined;
    }
    async sendStartCommandResponse(ctx, participant, userId, userName) {
        const userReferralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
        const finalUserReferralLink = userReferralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;
        const channelId = parseInt(config_1.default.channelId);
        const stats = await this.contestService.getParticipantStats(userId, channelId);
        let welcomeSent = false;
        if (stats?.tiktokTaskCompleted) {
            logger_1.default.info('User has already completed TikTok task - sending returning user welcome', {
                userId,
                userName,
                totalPoints: stats.points
            });
            welcomeSent = await this.telegramService.sendWelcomeReturningUser(userId, userName, stats.points, finalUserReferralLink);
        }
        else {
            logger_1.default.info('User has not completed TikTok task - sending TikTok welcome with buttons', {
                userId,
                userName
            });
            welcomeSent = await this.telegramService.sendWelcomeWithTikTok(userId, userName, finalUserReferralLink);
        }
        if (!welcomeSent) {
            logger_1.default.warn('Failed to send welcome message via TelegramService, sending fallback', {
                userId,
                userName,
                reason: 'User might have privacy settings that block messages from bots'
            });
            await ctx.reply(`🎯 Benvenuto ${userName}!\n\nPunti attuali: ${stats?.points || 0}\nTuo link: ${finalUserReferralLink}\n\nUsa /classifica per vedere la tua posizione!`);
        }
    }
    async sendPersonalStatistics(ctx, participant, _userId, _userName) {
        const tiktokPoints = participant.parsedTiktokLinks.length * 3;
        const referralPoints = participant.referralCount * 2;
        const variables = {
            displayName: participant.displayName,
            totalPoints: participant.points.toString(),
            tiktokCompleted: participant.tiktokTaskCompleted ? '✅ Sì' : '❌ No',
            tiktokLinksCount: participant.parsedTiktokLinks.length.toString(),
            tiktokPoints: tiktokPoints.toString(),
            referralCount: participant.referralCount.toString(),
            referralPoints: referralPoints.toString(),
            referralCode: participant.referralCode
        };
        const messageContent = await MessageService_1.default.loadMessage('personal_stats', {
            variables
        });
        await this.sendMarkdownMessage(ctx, messageContent, 'personal_stats');
    }
    async sendReferralLinkInfo(ctx, participant, userId, userName) {
        const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
        const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;
        const channelId = parseInt(config_1.default.channelId);
        const stats = await this.contestService.getParticipantStats(userId, channelId);
        const totalPoints = stats?.points || 0;
        try {
            const linkMessage = await MessageService_1.default.loadMessage('referral_link', {
                variables: {
                    userName,
                    referralLink: finalReferralLink,
                    totalPoints: totalPoints.toString(),
                    referralCode: participant.referralCode
                }
            });
            await this.sendMarkdownMessage(ctx, linkMessage, 'referral_link');
        }
        catch (templateError) {
            await ctx.reply(`🔗 *Il tuo link referral*\n\n` +
                `👋 Ciao ${userName}!\n\n` +
                `📊 Punti attuali: *${totalPoints}*\n\n` +
                `🎯 *Il tuo link personale:*\n` +
                `${finalReferralLink}\n\n` +
                `💡 *Come usarlo:*\n` +
                `• Condividi questo link con i tuoi amici\n` +
                `• Ogni persona che si unisce ti fa guadagnare 2 punti\n` +
                `• Più amici inviti, più punti accumuli!\n\n` +
                `📈 Usa /classifica per vedere le tue statistiche complete.`, {
                parse_mode: 'Markdown',
                link_preview_options: { is_disabled: true }
            });
        }
    }
    async sendMarkdownMessage(ctx, messageContent, commandType) {
        const processedContent = this.telegramService.processMarkdownText(messageContent);
        try {
            const replyOptions = {
                parse_mode: 'Markdown'
            };
            if (['help', 'referral_link'].includes(commandType)) {
                replyOptions.link_preview_options = { is_disabled: true };
            }
            await ctx.reply(processedContent, replyOptions);
            logger_1.default.info(`Markdown message sent successfully for ${commandType}`);
        }
        catch (markdownError) {
            logger_1.default.warn(`Custom Markdown parsing failed for ${commandType}, sending as plain text`, {
                error: markdownError
            });
            const plainText = messageContent.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');
            const plainOptions = {};
            if (['help', 'referral_link'].includes(commandType)) {
                plainOptions.link_preview_options = { is_disabled: true };
            }
            await ctx.reply(plainText, plainOptions);
        }
    }
    async sendFallbackHelpMessage(ctx) {
        await ctx.reply(`🆘 *Aiuto - LosBloccatore Bot*\n\n` +
            `📋 *Comandi disponibili:*\n` +
            `/start - Inizia e ottieni il tuo link referral\n` +
            `/help - Mostra questo messaggio di aiuto\n` +
            `/link - Ottieni il tuo link referral\n` +
            `/classifica - Vedi le tue statistiche\n\n` +
            `🎯 *Come funziona:*\n` +
            `• Unisciti al canale per partecipare\n` +
            `• Visita TikTok per guadagnare 3 punti\n` +
            `• Invita amici per guadagnare 2 punti ciascuno\n` +
            `• Usa il tuo link personale per invitare`, { parse_mode: 'Markdown' });
    }
    async handleCommandError(ctx, error, commandType) {
        logger_1.default.error(`Error handling ${commandType} command`, error);
        const errorMessages = {
            start: '❌ Errore durante l\'inizializzazione. Riprova più tardi.',
            classifica: '❌ Errore durante il recupero delle tue statistiche. Riprova più tardi.',
            link: '❌ Errore durante il recupero del tuo link. Riprova più tardi.',
            help: '❌ Errore durante il caricamento dell\'aiuto. Riprova più tardi.'
        };
        await ctx.reply(errorMessages[commandType] || '❌ Errore durante l\'esecuzione del comando.');
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=CommandHandler.js.map