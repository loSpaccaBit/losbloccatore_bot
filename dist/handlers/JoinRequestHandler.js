"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinRequestHandler = void 0;
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
class JoinRequestHandler {
    constructor(telegramService, userActivityService, contestService) {
        this.telegramService = telegramService;
        this.userActivityService = userActivityService;
        this.contestService = contestService;
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
            if (!this.isAuthorizedChannel(chatId)) {
                logger_1.default.info('Join request ignored - unauthorized channel', {
                    requestedChatId: chatId,
                    authorizedChatId: config_1.default.channelId,
                    userId,
                    userName
                });
                return;
            }
            const referralCode = await this.extractReferralCodeFromInviteLink(joinRequest.invite_link?.name);
            if (referralCode) {
                logger_1.default.info('Join request via referral invite link detected', {
                    userId,
                    userName,
                    referralCode,
                    inviteLinkName: joinRequest.invite_link?.name
                });
            }
            await this.processJoinRequest(joinRequest, referralCode, ctx);
        }
        catch (error) {
            await this.handleJoinRequestError(error, joinRequest, chatTitle);
        }
    }
    async processJoinRequest(joinRequest, referralCode, ctx) {
        const userId = joinRequest.from.id;
        const userName = joinRequest.from.first_name;
        const chatId = joinRequest.chat.id;
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
            await this.handleSuccessfulApproval(joinRequest, referralCode, ctx);
        }
        else {
            await this.handleFailedApproval(joinRequest);
        }
    }
    async handleSuccessfulApproval(joinRequest, referralCode, ctx) {
        const userId = joinRequest.from.id;
        const userName = joinRequest.from.first_name;
        const chatId = joinRequest.chat.id;
        const chatTitle = 'title' in joinRequest.chat ? joinRequest.chat.title : 'Unknown';
        logger_1.default.logUserApproved(userId, userName, chatId, chatTitle);
        await this.userActivityService.recordApproval(userId, chatId, chatTitle, joinRequest.from);
        await this.contestService.getOrCreateParticipant(userId, chatId, userName, joinRequest.from.last_name, joinRequest.from.username, referralCode);
        await this.sendWelcomeMessage(userId, userName, chatId, ctx);
    }
    async handleFailedApproval(joinRequest) {
        const userId = joinRequest.from.id;
        const userName = joinRequest.from.first_name;
        const chatId = joinRequest.chat.id;
        const chatTitle = 'title' in joinRequest.chat ? joinRequest.chat.title : 'Unknown';
        logger_1.default.error('Failed to approve join request', undefined, {
            userId,
            userName,
            chatId,
            chatTitle
        });
        await this.userActivityService.recordRejection(userId, chatId, chatTitle, joinRequest.from, 'Failed to approve via Telegram API');
    }
    async sendWelcomeMessage(userId, userName, chatId, ctx) {
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
    async handleJoinRequestError(error, joinRequest, chatTitle) {
        const userId = joinRequest.from.id;
        const userName = joinRequest.from.first_name;
        const chatId = joinRequest.chat.id;
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
    isAuthorizedChannel(chatId) {
        return chatId.toString() === config_1.default.channelId;
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
exports.JoinRequestHandler = JoinRequestHandler;
//# sourceMappingURL=JoinRequestHandler.js.map