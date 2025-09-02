"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramChatService = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
class TelegramChatService {
    constructor(coreService) {
        this.coreService = coreService;
        logger_1.default.info('TelegramChatService initialized');
    }
    async approveChatJoinRequest(chatId, userId) {
        try {
            const bot = this.coreService.getBot();
            await bot.telegram.approveChatJoinRequest(chatId, userId);
            logger_1.default.info('Join request approved successfully', {
                chatId,
                userId
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to approve chat join request', error, {
                chatId,
                userId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async declineChatJoinRequest(chatId, userId) {
        try {
            const bot = this.coreService.getBot();
            await bot.telegram.declineChatJoinRequest(chatId, userId);
            logger_1.default.info('Join request declined successfully', {
                chatId,
                userId
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to decline chat join request', error, {
                chatId,
                userId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getChatMemberCount(chatId) {
        try {
            const bot = this.coreService.getBot();
            const memberCount = await bot.telegram.getChatMembersCount(chatId);
            logger_1.default.debug('Retrieved chat member count', {
                chatId,
                memberCount
            });
            return memberCount;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat member count', error, {
                chatId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return 0;
        }
    }
    async getChatInfo(chatId) {
        try {
            const bot = this.coreService.getBot();
            const chatInfo = await bot.telegram.getChat(chatId);
            logger_1.default.debug('Retrieved chat info', {
                chatId,
                chatTitle: 'title' in chatInfo ? chatInfo.title : 'No title',
                chatType: chatInfo.type
            });
            return chatInfo;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat info', error, {
                chatId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async getChatMember(chatId, userId) {
        try {
            const bot = this.coreService.getBot();
            const member = await bot.telegram.getChatMember(chatId, userId);
            logger_1.default.debug('Retrieved chat member info', {
                chatId,
                userId,
                status: member.status
            });
            return member;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat member', error, {
                chatId,
                userId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async isUserMemberOfChat(chatId, userId) {
        try {
            const member = await this.getChatMember(chatId, userId);
            if (!member) {
                return false;
            }
            const activeMemberStatuses = ['member', 'administrator', 'creator'];
            return activeMemberStatuses.includes(member.status);
        }
        catch (error) {
            logger_1.default.error('Failed to check user membership', error, {
                chatId,
                userId
            });
            return false;
        }
    }
    async getChatAdministrators(chatId) {
        try {
            const bot = this.coreService.getBot();
            const administrators = await bot.telegram.getChatAdministrators(chatId);
            logger_1.default.debug('Retrieved chat administrators', {
                chatId,
                adminCount: administrators.length
            });
            return administrators;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat administrators', error, {
                chatId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async isUserAdminOfChat(chatId, userId) {
        try {
            const member = await this.getChatMember(chatId, userId);
            if (!member) {
                return false;
            }
            const adminStatuses = ['administrator', 'creator'];
            return adminStatuses.includes(member.status);
        }
        catch (error) {
            logger_1.default.error('Failed to check user admin status', error, {
                chatId,
                userId
            });
            return false;
        }
    }
    async banChatMember(chatId, userId, untilDate) {
        try {
            const bot = this.coreService.getBot();
            await bot.telegram.banChatMember(chatId, userId, untilDate);
            logger_1.default.info('Chat member banned successfully', {
                chatId,
                userId,
                untilDate
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to ban chat member', error, {
                chatId,
                userId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async unbanChatMember(chatId, userId) {
        try {
            const bot = this.coreService.getBot();
            await bot.telegram.unbanChatMember(chatId, userId);
            logger_1.default.info('Chat member unbanned successfully', {
                chatId,
                userId
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to unban chat member', error, {
                chatId,
                userId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
}
exports.TelegramChatService = TelegramChatService;
//# sourceMappingURL=TelegramChatService.js.map