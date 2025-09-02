"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotController = void 0;
const TelegramService_1 = require("../services/TelegramService");
const UserActivityService_1 = require("../services/UserActivityService");
const ContestService_1 = require("../services/ContestService");
const MessageService_1 = __importDefault(require("../services/MessageService"));
const cache_1 = __importDefault(require("../utils/cache"));
const index_1 = __importDefault(require("../config/index"));
const logger_1 = __importDefault(require("../utils/logger"));
const LeaderboardSchedulerService_1 = __importDefault(require("../services/LeaderboardSchedulerService"));
class BotController {
    constructor() {
        this.telegramService = new TelegramService_1.TelegramService();
        this.userActivityService = new UserActivityService_1.UserActivityService();
        this.contestService = new ContestService_1.ContestService();
    }
    async handleChatJoinRequest(ctx) {
        if (!('chat_join_request' in ctx.update)) {
            logger_1.default.warn('Invalid chat join request update', { update: ctx.update });
            return;
        }
        const joinRequest = ctx.update.chat_join_request;
        const userId = joinRequest.from.id;
        const userName = joinRequest.from.first_name;
        const chatId = joinRequest.chat.id;
        const chatTitle = 'title' in joinRequest.chat ? joinRequest.chat.title : 'Unknown';
        logger_1.default.logUserJoin(userId, userName, chatId, chatTitle);
        try {
            if (chatId.toString() !== index_1.default.channelId) {
                logger_1.default.info('Join request ignored - unauthorized channel', {
                    requestedChatId: chatId,
                    authorizedChatId: index_1.default.channelId,
                    userId,
                    userName
                });
                return;
            }
            let referralCode;
            if (joinRequest.invite_link) {
                referralCode = await this.extractReferralCodeFromInviteLink(joinRequest.invite_link.name);
                if (referralCode) {
                    logger_1.default.info('Join request via referral invite link detected', {
                        userId,
                        userName,
                        referralCode,
                        inviteLinkName: joinRequest.invite_link.name
                    });
                }
            }
            const joinRequestEvent = {
                user: joinRequest.from,
                chat: joinRequest.chat,
                date: joinRequest.date
            };
            await this.userActivityService.recordJoinRequest(joinRequestEvent);
            const hasJoinedBefore = await this.userActivityService.hasUserJoinedBefore(userId, chatId);
            if (hasJoinedBefore) {
                logger_1.default.info('User has joined before - auto-approving', {
                    userId,
                    userName,
                    chatId
                });
            }
            const approved = await this.telegramService.approveChatJoinRequest(chatId, userId);
            if (approved) {
                logger_1.default.logUserApproved(userId, userName, chatId, chatTitle);
                await this.userActivityService.recordApproval(userId, chatId, chatTitle, joinRequest.from);
                await this.contestService.getOrCreateParticipant(userId, chatId, userName, joinRequest.from.last_name, joinRequest.from.username, referralCode);
                const participantInfo = await this.contestService.getParticipantStats(userId, chatId);
                const userReferralCode = participantInfo?.referralCode || userId.toString();
                const referralLink = await this.telegramService.getReferralInviteLink(userReferralCode);
                const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${userReferralCode}`;
                let welcomeSent = false;
                if (participantInfo?.tiktokTaskCompleted) {
                    logger_1.default.info('User has already completed TikTok task - sending returning user welcome', {
                        userId,
                        userName,
                        totalPoints: participantInfo.points
                    });
                    welcomeSent = await this.telegramService.sendWelcomeReturningUser(userId, userName, participantInfo.points, finalReferralLink);
                }
                else {
                    logger_1.default.info('User has not completed TikTok task - sending TikTok welcome with buttons', {
                        userId,
                        userName
                    });
                    welcomeSent = await this.telegramService.sendWelcomeWithTikTok(userId, userName, finalReferralLink);
                }
                if (!welcomeSent) {
                    logger_1.default.warn('Failed to send welcome message', {
                        userId,
                        userName,
                        reason: 'User might have privacy settings that block messages from bots'
                    });
                }
            }
            else {
                logger_1.default.error('Failed to approve join request', undefined, {
                    userId,
                    userName,
                    chatId,
                    chatTitle
                });
                await this.userActivityService.recordRejection(userId, chatId, chatTitle, joinRequest.from, 'Failed to approve via Telegram API');
            }
        }
        catch (error) {
            logger_1.default.error('Error processing chat join request', error, {
                userId,
                userName,
                chatId,
                chatTitle
            });
            try {
                await this.userActivityService.recordRejection(userId, chatId, chatTitle, joinRequest.from, `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            catch (recordError) {
                logger_1.default.error('Failed to record join request error', recordError, {
                    originalError: error,
                    userId,
                    chatId
                });
            }
        }
    }
    async handleChatMemberUpdate(ctx) {
        if (!('chat_member' in ctx.update)) {
            logger_1.default.warn('Invalid chat member update', { update: ctx.update });
            return;
        }
        const memberUpdate = ctx.update.chat_member;
        const chatId = memberUpdate.chat.id;
        const oldStatus = memberUpdate.old_chat_member.status;
        const newStatus = memberUpdate.new_chat_member.status;
        const user = memberUpdate.new_chat_member.user;
        const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';
        logger_1.default.debug('Chat member status change', {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
            chatId,
            chatTitle,
            oldStatus,
            newStatus,
            isBot: user.is_bot
        });
        try {
            if (user.is_bot) {
                logger_1.default.debug('Skipping bot member update', {
                    botId: user.id,
                    botUsername: user.username,
                    chatId,
                    oldStatus,
                    newStatus
                });
                return;
            }
            if (chatId.toString() !== index_1.default.channelId) {
                logger_1.default.debug('Member update ignored - unauthorized channel', {
                    chatId,
                    authorizedChatId: index_1.default.channelId
                });
                return;
            }
            const memberStatuses = ['member', 'administrator', 'creator'];
            const leftStatuses = ['left', 'kicked', 'banned'];
            const wasActive = memberStatuses.includes(oldStatus);
            const isLeft = leftStatuses.includes(newStatus);
            if (wasActive && isLeft) {
                logger_1.default.logUserLeft(user.id, user.first_name, chatId, chatTitle);
                const chatMemberUpdateEvent = {
                    chat: {
                        id: memberUpdate.chat.id,
                        title: chatTitle,
                        type: memberUpdate.chat.type
                    },
                    from: memberUpdate.from,
                    date: memberUpdate.date,
                    old_chat_member: memberUpdate.old_chat_member,
                    new_chat_member: memberUpdate.new_chat_member
                };
                await this.userActivityService.recordUserLeave(chatMemberUpdateEvent);
                await this.contestService.handleUserLeft(user.id, chatId);
                const goodbyeSent = await this.telegramService.sendGoodbyeMessage(user.id, user.first_name, {
                    includeReturnMessage: true
                });
                if (!goodbyeSent) {
                    logger_1.default.info('Could not send goodbye message', {
                        userId: user.id,
                        username: user.username,
                        reason: 'User privacy settings or bot was blocked'
                    });
                }
            }
            else if (!wasActive && memberStatuses.includes(newStatus)) {
                logger_1.default.info('User joined channel via member update', {
                    userId: user.id,
                    username: user.username,
                    firstName: user.first_name,
                    chatId,
                    newStatus
                });
                await this.userActivityService.recordApproval(user.id, chatId, chatTitle, user);
                await this.contestService.getOrCreateParticipant(user.id, chatId, user.first_name, user.last_name, user.username);
            }
        }
        catch (error) {
            logger_1.default.error('Error processing chat member update', error, {
                userId: user.id,
                username: user.username,
                chatId,
                oldStatus,
                newStatus
            });
        }
    }
    async handleLeftChatMember(ctx) {
        if (!('message' in ctx.update) || !('left_chat_member' in ctx.update.message)) {
            logger_1.default.warn('Invalid left chat member update', { update: ctx.update });
            return;
        }
        const message = ctx.update.message;
        const leftUser = message.left_chat_member;
        const chatId = message.chat.id;
        const chatTitle = 'title' in message.chat ? message.chat.title : 'Unknown Chat';
        logger_1.default.logUserLeft(leftUser.id, leftUser.first_name, chatId, chatTitle);
        try {
            if (chatId.toString() !== index_1.default.channelId) {
                logger_1.default.debug('Left member event ignored - unauthorized channel', {
                    chatId,
                    authorizedChatId: index_1.default.channelId
                });
                return;
            }
            logger_1.default.info('User left via left_chat_member event', {
                userId: leftUser.id,
                username: leftUser.username,
                firstName: leftUser.first_name,
                chatId,
                note: 'This event works for small groups (<50 members)'
            });
            const simplifiedMemberUpdate = {
                chat: {
                    id: chatId,
                    title: chatTitle,
                    type: message.chat.type
                },
                from: leftUser,
                date: message.date,
                old_chat_member: {
                    user: leftUser,
                    status: 'member'
                },
                new_chat_member: {
                    user: leftUser,
                    status: 'left'
                }
            };
            await this.userActivityService.recordUserLeave(simplifiedMemberUpdate);
            const goodbyeSent = await this.telegramService.sendGoodbyeMessage(leftUser.id, leftUser.first_name, {
                includeReturnMessage: true
            });
            if (!goodbyeSent) {
                logger_1.default.info('Could not send goodbye message via left_chat_member', {
                    userId: leftUser.id,
                    username: leftUser.username,
                    possibleCauses: [
                        'User blocked the bot',
                        'Privacy settings prevent messages',
                        'Group size >50 members'
                    ]
                });
            }
        }
        catch (error) {
            logger_1.default.error('Error processing left chat member', error, {
                userId: leftUser.id,
                username: leftUser.username,
                chatId
            });
        }
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
        return;
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
            let referralCode;
            if ('text' in message && message.text) {
                const startPayload = message.text.split(' ')[1];
                if (startPayload && startPayload !== userId.toString()) {
                    referralCode = startPayload;
                    logger_1.default.info('Start command with referral', { userId, userName, referralCode });
                }
                else {
                    logger_1.default.info('Start command without referral', { userId, userName });
                }
            }
            const channelId = parseInt(index_1.default.channelId);
            const participant = await this.contestService.getOrCreateParticipant(userId, channelId, userName, message.from.last_name, message.from.username, referralCode);
            const userReferralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
            const finalUserReferralLink = userReferralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;
            const stats = await this.contestService.getParticipantStats(userId, channelId);
            const totalPoints = stats?.points || 0;
            try {
                const messageContent = await MessageService_1.default.loadMessage('contest_welcome', {
                    variables: {
                        userName,
                        totalPoints,
                        referralLink: finalUserReferralLink
                    }
                });
                await ctx.reply(messageContent, { parse_mode: 'Markdown' });
                logger_1.default.info('Contest welcome message sent successfully', { userId, userName });
            }
            catch (error) {
                logger_1.default.error('Failed to send contest welcome message', error, { userId, userName });
                await ctx.reply(`🎯 Benvenuto ${userName}!\n\nPunti attuali: ${totalPoints}\nTuo link: ${finalUserReferralLink}\n\nUsa /classifica per vedere la tua posizione!`);
            }
            logger_1.default.info('Start command processed successfully', {
                userId,
                userName,
                chatId,
                hadReferral: !!referralCode,
                totalPoints
            });
        }
        catch (error) {
            logger_1.default.error('Error handling start command', error, {
                userId,
                userName,
                chatId
            });
            await ctx.reply('❌ Errore durante l\'inizializzazione. Riprova più tardi.');
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
            const channelId = parseInt(index_1.default.channelId);
            const participant = await this.contestService.getUserPersonalStats(userId, channelId);
            if (!participant) {
                await ctx.reply('❌ Non sei ancora registrato nel contest. Unisciti al canale per iniziare!');
                return;
            }
            if (!participant.isActive) {
                await ctx.reply('❌ Il tuo profilo non è attivo. Unisciti nuovamente al canale per partecipare!');
                return;
            }
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
            const processedContent = this.telegramService.processMarkdownText(messageContent);
            try {
                await ctx.reply(processedContent, { parse_mode: 'Markdown' });
                logger_1.default.info('Markdown message sent successfully with custom parser', {
                    userId,
                    userName
                });
            }
            catch (markdownError) {
                logger_1.default.warn('Custom Markdown parsing still failed, sending as plain text', {
                    error: markdownError,
                    userId,
                    userName
                });
                const plainText = messageContent.replace(/\*\*/g, '').replace(/\*/g, '');
                await ctx.reply(plainText);
            }
        }
        catch (error) {
            logger_1.default.error('Error handling classifica command', error, {
                userId,
                userName
            });
            await ctx.reply('❌ Errore durante il recupero delle tue statistiche. Riprova più tardi.');
        }
    }
    async handleMyChatMember(ctx) {
        if (!('my_chat_member' in ctx.update)) {
            logger_1.default.warn('Invalid my_chat_member update', { update: ctx.update });
            return;
        }
        const memberUpdate = ctx.update.my_chat_member;
        const chatId = memberUpdate.chat.id;
        const oldStatus = memberUpdate.old_chat_member.status;
        const newStatus = memberUpdate.new_chat_member.status;
        const botUser = memberUpdate.new_chat_member.user;
        const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';
        logger_1.default.info('Bot status change in chat', {
            botId: botUser.id,
            botUsername: botUser.username,
            chatId,
            chatTitle,
            oldStatus,
            newStatus,
            from: memberUpdate.from
        });
        if (newStatus === 'administrator' && oldStatus !== 'administrator') {
            logger_1.default.info('Bot promoted to administrator', { chatId, chatTitle });
        }
        else if (newStatus === 'left' || newStatus === 'kicked') {
            logger_1.default.warn('Bot removed from chat', { chatId, chatTitle, newStatus });
        }
        else if (newStatus === 'member' && (oldStatus === 'left' || oldStatus === 'kicked')) {
            logger_1.default.info('Bot added back to chat', { chatId, chatTitle });
        }
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
                const targetUserId = parseInt(data.split(':')[1]);
                if (userId !== targetUserId) {
                    const errorMessage = await MessageService_1.default.loadMessage('tiktok_button_not_for_you').catch(() => '❌ Questo pulsante non è per te!');
                    await ctx.answerCbQuery(errorMessage, { show_alert: true });
                    return;
                }
                const welcomeTime = cache_1.default.get(`welcome_sent:${userId}`);
                if (!welcomeTime || Date.now() - welcomeTime < 30000) {
                    const waitMessage = await MessageService_1.default.loadMessage('tiktok_wait_required').catch(() => '⚠️ Devi prima cliccare "Apri TikTok", visitare la pagina e seguire/commentare! Attendi almeno 30 secondi.');
                    await ctx.answerCbQuery(waitMessage, { show_alert: true });
                    return;
                }
                const participant = await this.contestService.getOrCreateParticipant(userId, parseInt(index_1.default.channelId), userName, callbackQuery.from.last_name, callbackQuery.from.username);
                if (participant.tiktokTaskCompleted) {
                    const completedMessage = await MessageService_1.default.loadMessage('tiktok_already_completed').catch(() => '✅ Hai già completato il task TikTok!');
                    await ctx.answerCbQuery(completedMessage, { show_alert: true });
                    return;
                }
                const tikTokSubmitted = await this.contestService.completeTiktokTaskViaButton(userId, parseInt(index_1.default.channelId));
                if (tikTokSubmitted) {
                    logger_1.default.info('TikTok task completed successfully, preparing success message', {
                        userId,
                        userName
                    });
                    const updatedParticipant = await this.contestService.getParticipantStats(userId, parseInt(index_1.default.channelId));
                    const totalPoints = updatedParticipant?.points || 0;
                    await ctx.answerCbQuery('🎉 TikTok visitato! +3 punti!', { show_alert: false });
                    const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
                    const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;
                    logger_1.default.info('Sending TikTok success message using centralized template', {
                        userId,
                        userName,
                        totalPoints,
                        referralLink
                    });
                    const messageSuccessfullySent = await this.telegramService.sendTikTokPointsMessage(userId, userName, totalPoints, finalReferralLink);
                    if (messageSuccessfullySent) {
                        logger_1.default.info('TikTok success message sent successfully via centralized service', { userId, userName });
                    }
                    else {
                        logger_1.default.warn('Failed to send TikTok message via service, sending fallback message', { userId, userName });
                        await this.telegramService.getBot().telegram.sendMessage(userId, `🎉 Complimenti! Hai completato il task TikTok: +3 punti!\n\n📊 Punti totali: ${totalPoints}\n\n🔗 Il tuo link: ${finalReferralLink}`, { link_preview_options: { is_disabled: true } });
                    }
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
        }
        catch (error) {
            logger_1.default.error('Error handling TikTok callback', error, {
                userId,
                userName,
                callbackData: data
            });
            try {
                await ctx.answerCbQuery('❌ Errore durante l\'elaborazione. Riprova più tardi.', { show_alert: true });
            }
            catch (answerError) {
                logger_1.default.error('Failed to answer callback query', answerError);
            }
        }
    }
    getTelegramService() {
        return this.telegramService;
    }
    getUserActivityService() {
        return this.userActivityService;
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
            const processedContent = this.telegramService.processMarkdownText(helpMessage);
            try {
                await ctx.reply(processedContent, {
                    parse_mode: 'Markdown',
                    link_preview_options: { is_disabled: true }
                });
                logger_1.default.info('Help command processed successfully', {
                    userId,
                    userName
                });
            }
            catch (markdownError) {
                logger_1.default.warn('Custom Markdown parsing failed for help message, sending as plain text', {
                    error: markdownError,
                    userId,
                    userName
                });
                const plainText = helpMessage.replace(/\*/g, '').replace(/_/g, '');
                await ctx.reply(plainText, { link_preview_options: { is_disabled: true } });
            }
        }
        catch (error) {
            logger_1.default.error('Error handling help command', error, {
                userId,
                userName
            });
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
            const channelId = parseInt(index_1.default.channelId);
            const participant = await this.contestService.getOrCreateParticipant(userId, channelId, userName, message.from?.last_name, message.from?.username);
            const referralLink = await this.telegramService.getReferralInviteLink(participant.referralCode);
            const finalReferralLink = referralLink || `https://t.me/${(await ctx.telegram.getMe()).username}?start=${participant.referralCode}`;
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
                const processedContent = this.telegramService.processMarkdownText(linkMessage);
                try {
                    await ctx.reply(processedContent, {
                        parse_mode: 'Markdown',
                        link_preview_options: { is_disabled: true }
                    });
                }
                catch (markdownError) {
                    logger_1.default.warn('Custom Markdown parsing failed for link message, sending as plain text', {
                        error: markdownError,
                        userId,
                        userName
                    });
                    const plainText = linkMessage.replace(/\*/g, '').replace(/_/g, '');
                    await ctx.reply(plainText, { link_preview_options: { is_disabled: true } });
                }
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
            logger_1.default.info('Link command processed successfully', {
                userId,
                userName,
                referralCode: participant.referralCode,
                totalPoints
            });
        }
        catch (error) {
            logger_1.default.error('Error handling link command', error, {
                userId,
                userName
            });
            await ctx.reply('❌ Errore durante il recupero del tuo link. Riprova più tardi.');
        }
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
            await ctx.reply('✅ Classifica generata e inviata nel canale!');
            logger_1.default.info('Manual leaderboard generation triggered by admin', {
                adminUserId: userId
            });
        }
        catch (error) {
            await ctx.reply('❌ Errore durante la generazione della classifica.');
            logger_1.default.error('Failed to generate manual leaderboard', error, {
                adminUserId: userId
            });
        }
    }
    isAdmin(userId) {
        return index_1.default.adminUserId !== undefined && index_1.default.adminUserId === userId;
    }
    getContestService() {
        return this.contestService;
    }
    async extractReferralCodeFromInviteLink(inviteLinkName) {
        if (!inviteLinkName) {
            return undefined;
        }
        const match = inviteLinkName.match(/^Referral: (.+)$/);
        if (match && match[1]) {
            logger_1.default.debug('Referral code extracted from invite link', {
                linkName: inviteLinkName,
                referralCode: match[1]
            });
            return match[1];
        }
        return undefined;
    }
}
exports.BotController = BotController;
//# sourceMappingURL=BotController.old.js.map