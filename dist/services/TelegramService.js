"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const TelegramCoreService_1 = require("../domains/telegram/TelegramCoreService");
const TelegramMessageService_1 = require("../domains/telegram/TelegramMessageService");
const TelegramChatService_1 = require("../domains/telegram/TelegramChatService");
const TelegramInviteService_1 = require("../domains/telegram/TelegramInviteService");
const logger_1 = __importDefault(require("../utils/logger"));
class TelegramService {
    constructor() {
        this.coreService = new TelegramCoreService_1.TelegramCoreService();
        this.messageService = new TelegramMessageService_1.TelegramMessageService(this.coreService);
        this.chatService = new TelegramChatService_1.TelegramChatService(this.coreService);
        this.inviteService = new TelegramInviteService_1.TelegramInviteService(this.coreService);
        logger_1.default.info('TelegramService initialized with all domain services');
    }
    getBot() {
        return this.coreService.getBot();
    }
    async startPolling() {
        return this.coreService.startPolling();
    }
    async stop() {
        return this.coreService.stop();
    }
    isCurrentlyPolling() {
        return this.coreService.isCurrentlyPolling();
    }
    async getBotInfo() {
        return this.coreService.getBotInfo();
    }
    processMarkdownText(text) {
        return this.messageService.processMarkdownText(text);
    }
    async sendWelcomeWithTikTok(userId, userName, referralLink) {
        return this.messageService.sendWelcomeWithTikTok(userId, userName, referralLink);
    }
    async sendWelcomeReturningUser(userId, userName, totalPoints, referralLink) {
        return this.messageService.sendWelcomeReturningUser(userId, userName, totalPoints, referralLink);
    }
    async sendTikTokPointsMessage(userId, userName, totalPoints, referralLink) {
        return this.messageService.sendTikTokPointsMessage(userId, userName, totalPoints, referralLink);
    }
    async sendGoodbyeMessage(userId, userName, options) {
        return this.messageService.sendGoodbyeMessage(userId, userName, options);
    }
    async sendPhoto(chatId, photoPath, caption, options) {
        return this.messageService.sendPhoto(chatId, photoPath, caption, options);
    }
    async approveChatJoinRequest(chatId, userId) {
        return this.chatService.approveChatJoinRequest(chatId, userId);
    }
    async declineChatJoinRequest(chatId, userId) {
        return this.chatService.declineChatJoinRequest(chatId, userId);
    }
    async getChatMemberCount(chatId) {
        return this.chatService.getChatMemberCount(chatId);
    }
    async getChatInfo(chatId) {
        return this.chatService.getChatInfo(chatId);
    }
    async getChatMember(chatId, userId) {
        return this.chatService.getChatMember(chatId, userId);
    }
    async isUserMemberOfChat(chatId, userId) {
        return this.chatService.isUserMemberOfChat(chatId, userId);
    }
    async isUserAdminOfChat(chatId, userId) {
        return this.chatService.isUserAdminOfChat(chatId, userId);
    }
    async createChannelInviteLink(chatId, name, expireDate, memberLimit) {
        return this.inviteService.createChannelInviteLink(chatId, name, expireDate, memberLimit);
    }
    async getReferralInviteLink(referralCode) {
        return this.inviteService.getReferralInviteLink(referralCode);
    }
    async revokeInviteLink(chatId, inviteLink) {
        return this.inviteService.revokeInviteLink(chatId, inviteLink);
    }
    async exportChatInviteLink(chatId) {
        return this.inviteService.exportChatInviteLink(chatId);
    }
    getCoreService() {
        return this.coreService;
    }
    getMessageService() {
        return this.messageService;
    }
    getChatService() {
        return this.chatService;
    }
    getInviteService() {
        return this.inviteService;
    }
    async healthCheck() {
        try {
            const coreHealthy = await this.coreService.healthCheck();
            return {
                overall: coreHealthy,
                core: coreHealthy,
                details: {
                    isPolling: this.coreService.isCurrentlyPolling(),
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            logger_1.default.error('Telegram service health check failed', error);
            return {
                overall: false,
                core: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
    getStats() {
        return {
            isPolling: this.coreService.isCurrentlyPolling(),
            referralLinkStats: this.inviteService.getReferralLinkStats(),
            timestamp: new Date().toISOString()
        };
    }
}
exports.TelegramService = TelegramService;
//# sourceMappingURL=TelegramService.js.map