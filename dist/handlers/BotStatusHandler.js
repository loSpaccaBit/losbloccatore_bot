"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotStatusHandler = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class BotStatusHandler {
    constructor() { }
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
        try {
            await this.processBotStatusChange(memberUpdate, oldStatus, newStatus, chatId, chatTitle);
        }
        catch (error) {
            logger_1.default.error('Error processing bot status change', error, {
                chatId,
                chatTitle,
                oldStatus,
                newStatus,
                botId: botUser.id
            });
        }
    }
    async processBotStatusChange(memberUpdate, oldStatus, newStatus, chatId, chatTitle) {
        if (this.isBotPromotedToAdmin(oldStatus, newStatus)) {
            await this.handleBotPromotedToAdmin(memberUpdate, chatId, chatTitle);
        }
        else if (this.isBotRemovedFromChat(newStatus)) {
            await this.handleBotRemovedFromChat(memberUpdate, chatId, chatTitle, newStatus);
        }
        else if (this.isBotAddedToChat(oldStatus, newStatus)) {
            await this.handleBotAddedToChat(memberUpdate, chatId, chatTitle);
        }
        else if (this.isBotDemoted(oldStatus, newStatus)) {
            await this.handleBotDemoted(memberUpdate, chatId, chatTitle);
        }
        else {
            logger_1.default.debug('Other bot status change', {
                chatId,
                chatTitle,
                oldStatus,
                newStatus,
                change: `${oldStatus} -> ${newStatus}`
            });
        }
    }
    async handleBotPromotedToAdmin(memberUpdate, chatId, chatTitle) {
        logger_1.default.info('Bot promoted to administrator', {
            chatId,
            chatTitle,
            promotedBy: memberUpdate.from?.first_name || 'Unknown'
        });
        const adminRights = memberUpdate.new_chat_member.can_invite_users ||
            memberUpdate.new_chat_member.can_manage_chat ||
            memberUpdate.new_chat_member.can_delete_messages;
        if (adminRights) {
            logger_1.default.info('Bot granted admin permissions', {
                chatId,
                chatTitle,
                permissions: {
                    can_invite_users: memberUpdate.new_chat_member.can_invite_users,
                    can_manage_chat: memberUpdate.new_chat_member.can_manage_chat,
                    can_delete_messages: memberUpdate.new_chat_member.can_delete_messages,
                    can_restrict_members: memberUpdate.new_chat_member.can_restrict_members
                }
            });
        }
    }
    async handleBotRemovedFromChat(memberUpdate, chatId, chatTitle, newStatus) {
        logger_1.default.warn('Bot removed from chat', {
            chatId,
            chatTitle,
            newStatus,
            removedBy: memberUpdate.from?.first_name || 'Unknown'
        });
        const removalReason = newStatus === 'kicked' ? 'kicked by admin' : 'left the chat';
        logger_1.default.warn('Bot access lost', {
            chatId,
            chatTitle,
            reason: removalReason,
            timestamp: new Date().toISOString()
        });
    }
    async handleBotAddedToChat(memberUpdate, chatId, chatTitle) {
        logger_1.default.info('Bot added back to chat', {
            chatId,
            chatTitle,
            addedBy: memberUpdate.from?.first_name || 'Unknown'
        });
        const hasBasicPermissions = memberUpdate.new_chat_member.status === 'administrator' ||
            memberUpdate.new_chat_member.status === 'member';
        if (!hasBasicPermissions) {
            logger_1.default.warn('Bot added but with restricted permissions', {
                chatId,
                chatTitle,
                status: memberUpdate.new_chat_member.status
            });
        }
    }
    async handleBotDemoted(memberUpdate, chatId, chatTitle) {
        logger_1.default.warn('Bot demoted from administrator', {
            chatId,
            chatTitle,
            demotedBy: memberUpdate.from?.first_name || 'Unknown'
        });
        logger_1.default.warn('Bot admin privileges revoked', {
            chatId,
            chatTitle,
            newStatus: memberUpdate.new_chat_member.status,
            timestamp: new Date().toISOString()
        });
    }
    isBotPromotedToAdmin(oldStatus, newStatus) {
        return newStatus === 'administrator' && oldStatus !== 'administrator';
    }
    isBotRemovedFromChat(newStatus) {
        return newStatus === 'left' || newStatus === 'kicked';
    }
    isBotAddedToChat(oldStatus, newStatus) {
        const wasRemoved = oldStatus === 'left' || oldStatus === 'kicked';
        const isNowActive = newStatus === 'member' || newStatus === 'administrator';
        return wasRemoved && isNowActive;
    }
    isBotDemoted(oldStatus, newStatus) {
        return oldStatus === 'administrator' && newStatus === 'member';
    }
    async getBotStatus(ctx, chatId) {
        try {
            const botInfo = await ctx.telegram.getMe();
            const chatMember = await ctx.telegram.getChatMember(chatId, botInfo.id);
            return chatMember.status;
        }
        catch (error) {
            logger_1.default.error('Failed to get bot status', error, { chatId });
            return null;
        }
    }
    async hasBotAdminPermissions(ctx, chatId) {
        try {
            const botInfo = await ctx.telegram.getMe();
            const chatMember = await ctx.telegram.getChatMember(chatId, botInfo.id);
            return chatMember.status === 'administrator' || chatMember.status === 'creator';
        }
        catch (error) {
            logger_1.default.error('Failed to check bot admin permissions', error, { chatId });
            return false;
        }
    }
}
exports.BotStatusHandler = BotStatusHandler;
//# sourceMappingURL=BotStatusHandler.js.map