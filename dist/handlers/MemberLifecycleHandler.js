"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberLifecycleHandler = void 0;
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
class MemberLifecycleHandler {
    constructor(telegramService, userActivityService, contestService) {
        this.telegramService = telegramService;
        this.userActivityService = userActivityService;
        this.contestService = contestService;
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
            if (!this.isAuthorizedChannel(chatId)) {
                logger_1.default.debug('Member update ignored - unauthorized channel', {
                    chatId,
                    authorizedChatId: config_1.default.channelId
                });
                return;
            }
            await this.processMemberStatusChange(memberUpdate);
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
            if (!this.isAuthorizedChannel(chatId)) {
                logger_1.default.debug('Left member event ignored - unauthorized channel', {
                    chatId,
                    authorizedChatId: config_1.default.channelId
                });
                return;
            }
            await this.processLegacyUserLeave(message, leftUser, chatId, chatTitle);
        }
        catch (error) {
            logger_1.default.error('Error processing left chat member', error, {
                userId: leftUser.id,
                username: leftUser.username,
                chatId
            });
        }
    }
    async processMemberStatusChange(memberUpdate) {
        const oldStatus = memberUpdate.old_chat_member.status;
        const newStatus = memberUpdate.new_chat_member.status;
        const user = memberUpdate.new_chat_member.user;
        const chatId = memberUpdate.chat.id;
        logger_1.default.info('Processing member status change', {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
            chatId,
            oldStatus,
            newStatus,
            statusTransition: `${oldStatus} -> ${newStatus}`
        });
        const memberStatuses = ['member', 'administrator', 'creator'];
        const leftStatuses = ['left', 'kicked', 'banned'];
        const wasActive = memberStatuses.includes(oldStatus);
        const isActive = memberStatuses.includes(newStatus);
        const isLeft = leftStatuses.includes(newStatus);
        logger_1.default.debug('Status analysis', {
            userId: user.id,
            wasActive,
            isActive,
            isLeft,
            memberStatuses,
            leftStatuses
        });
        if (wasActive && isLeft) {
            logger_1.default.info('User is leaving the channel - triggering goodbye flow', {
                userId: user.id,
                username: user.username,
                firstName: user.first_name,
                chatId,
                oldStatus,
                newStatus
            });
            await this.handleUserLeave(memberUpdate);
        }
        else if (!wasActive && isActive) {
            await this.handleUserJoinViaMemberUpdate(memberUpdate);
        }
        else {
            logger_1.default.debug('Other member status change', {
                userId: user.id,
                username: user.username,
                chatId,
                oldStatus,
                newStatus
            });
        }
    }
    async handleUserLeave(memberUpdate) {
        const user = memberUpdate.new_chat_member.user;
        const chatId = memberUpdate.chat.id;
        const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';
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
        await this.sendGoodbyeMessage(user);
    }
    async handleUserJoinViaMemberUpdate(memberUpdate) {
        const user = memberUpdate.new_chat_member.user;
        const chatId = memberUpdate.chat.id;
        const chatTitle = 'title' in memberUpdate.chat ? memberUpdate.chat.title : 'Unknown';
        logger_1.default.info('User joined channel via member update', {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
            chatId,
            newStatus: memberUpdate.new_chat_member.status
        });
        await this.userActivityService.recordApproval(user.id, chatId, chatTitle, user);
        await this.contestService.getOrCreateParticipant(user.id, chatId, user.first_name, user.last_name, user.username);
    }
    async processLegacyUserLeave(message, leftUser, chatId, chatTitle) {
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
        await this.sendGoodbyeMessage(leftUser);
    }
    async sendGoodbyeMessage(user) {
        logger_1.default.info('Attempting to send goodbye message', {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
            step: 'before_telegram_service_call'
        });
        const goodbyeSent = await this.telegramService.sendGoodbyeMessage(user.id, user.first_name, {
            includeReturnMessage: true
        });
        logger_1.default.info('Goodbye message attempt result', {
            userId: user.id,
            username: user.username,
            firstName: user.first_name,
            goodbyeSent,
            step: 'after_telegram_service_call'
        });
        if (!goodbyeSent) {
            logger_1.default.warn('Could not send goodbye message - detailed logging', {
                userId: user.id,
                username: user.username,
                firstName: user.first_name,
                reasons: [
                    'User privacy settings prevent messages',
                    'User blocked the bot',
                    'User started bot but then blocked it',
                    'Telegram API restrictions',
                    'Network or service error'
                ]
            });
        }
        else {
            logger_1.default.info('Goodbye message sent successfully', {
                userId: user.id,
                username: user.username,
                firstName: user.first_name
            });
        }
    }
    isAuthorizedChannel(chatId) {
        return chatId.toString() === config_1.default.channelId;
    }
}
exports.MemberLifecycleHandler = MemberLifecycleHandler;
//# sourceMappingURL=MemberLifecycleHandler.js.map