"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramInviteService = void 0;
const cache_1 = __importDefault(require("../../utils/cache"));
const config_1 = __importDefault(require("../../config"));
const logger_1 = __importDefault(require("../../utils/logger"));
class TelegramInviteService {
    constructor(coreService) {
        this.coreService = coreService;
        logger_1.default.info('TelegramInviteService initialized');
    }
    async createChannelInviteLink(chatId, name, expireDate, memberLimit) {
        try {
            const bot = this.coreService.getBot();
            const linkOptions = {};
            if (name)
                linkOptions.name = name;
            if (expireDate)
                linkOptions.expire_date = expireDate;
            if (memberLimit)
                linkOptions.member_limit = memberLimit;
            const inviteLink = await bot.telegram.createChatInviteLink(chatId, linkOptions);
            logger_1.default.info('Channel invite link created successfully', {
                chatId,
                name,
                expireDate,
                memberLimit,
                inviteLink: inviteLink.invite_link
            });
            return inviteLink.invite_link;
        }
        catch (error) {
            logger_1.default.error('Failed to create channel invite link', error, {
                chatId,
                name,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async getReferralInviteLink(referralCode) {
        try {
            const cacheKey = `referral_link:${referralCode}`;
            const cachedLink = cache_1.default.get(cacheKey);
            if (cachedLink) {
                logger_1.default.debug('Using cached referral link', { referralCode });
                return cachedLink;
            }
            const chatId = parseInt(config_1.default.channelId);
            const linkName = `Referral: ${referralCode}`;
            const expireDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
            const inviteLink = await this.createChannelInviteLink(chatId, linkName, expireDate);
            if (inviteLink) {
                cache_1.default.setWithTTL(cacheKey, inviteLink, 25 * 24 * 60 * 60);
                logger_1.default.info('Referral invite link created and cached', {
                    referralCode,
                    inviteLink,
                    expireDate: new Date(expireDate * 1000).toISOString()
                });
                return inviteLink;
            }
            return null;
        }
        catch (error) {
            logger_1.default.error('Failed to get referral invite link', error, {
                referralCode,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async revokeInviteLink(chatId, inviteLink) {
        try {
            const bot = this.coreService.getBot();
            await bot.telegram.revokeChatInviteLink(chatId, inviteLink);
            logger_1.default.info('Invite link revoked successfully', {
                chatId,
                inviteLink
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to revoke invite link', error, {
                chatId,
                inviteLink,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getChatInviteLinks(chatId) {
        try {
            const bot = this.coreService.getBot();
            const botInfo = await bot.telegram.getMe();
            await bot.telegram.getChat(chatId);
            logger_1.default.debug('Retrieved chat invite links', {
                chatId,
                botId: botInfo.id
            });
            return [];
        }
        catch (error) {
            logger_1.default.error('Failed to get chat invite links', error, {
                chatId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async exportChatInviteLink(chatId) {
        try {
            const bot = this.coreService.getBot();
            const inviteLink = await bot.telegram.exportChatInviteLink(chatId);
            logger_1.default.info('Primary chat invite link exported', {
                chatId,
                inviteLink
            });
            return inviteLink;
        }
        catch (error) {
            logger_1.default.error('Failed to export chat invite link', error, {
                chatId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async cleanupExpiredReferralLinks() {
        try {
            let cleanedCount = 0;
            logger_1.default.info('Referral link cache cleanup completed', {
                cleanedCount
            });
            return cleanedCount;
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup expired referral links', error);
            return 0;
        }
    }
    getCachedReferralLink(referralCode) {
        const cacheKey = `referral_link:${referralCode}`;
        return cache_1.default.get(cacheKey) || null;
    }
    clearCachedReferralLink(referralCode) {
        const cacheKey = `referral_link:${referralCode}`;
        cache_1.default.del(cacheKey);
        logger_1.default.debug('Referral link cache cleared', { referralCode });
    }
    getReferralLinkStats() {
        return {
            totalCached: 0,
            cacheHitRate: 0
        };
    }
}
exports.TelegramInviteService = TelegramInviteService;
//# sourceMappingURL=TelegramInviteService.js.map