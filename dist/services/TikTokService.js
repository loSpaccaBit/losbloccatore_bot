"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importDefault(require("../utils/cache"));
const MessageService_1 = __importDefault(require("./MessageService"));
const client_1 = require("@prisma/client");
class TikTokService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    static getInstance() {
        if (!TikTokService.instance) {
            TikTokService.instance = new TikTokService();
        }
        return TikTokService.instance;
    }
    async getTikTokPoints() {
        const points = await MessageService_1.default.getSetting('POINTS_PER_TIKTOK', '3');
        return parseInt(points) || 3;
    }
    async getReferralPoints() {
        const points = await MessageService_1.default.getSetting('POINTS_PER_REFERRAL', '2');
        return parseInt(points) || 2;
    }
    async processTikTokClick(userId, userName, clickedUrl) {
        const cacheKey = `tiktok_click:${userId}:${clickedUrl}`;
        if (cache_1.default.get(cacheKey)) {
            logger_1.default.debug('TikTok URL already clicked by user', { userId, userName, clickedUrl });
            const totalPoints = await this.getUserTotalPoints(userId);
            return { success: false, pointsAwarded: 0, totalPoints, newClick: false };
        }
        try {
            const tikTokPoints = await this.getTikTokPoints();
            await this.recordTikTokClick(userId, userName, clickedUrl, tikTokPoints);
            cache_1.default.set(cacheKey, true, 86400);
            const totalPoints = await this.getUserTotalPoints(userId);
            logger_1.default.info('TikTok click processed successfully', {
                userId,
                userName,
                clickedUrl,
                pointsAwarded: tikTokPoints,
                totalPoints
            });
            return {
                success: true,
                pointsAwarded: tikTokPoints,
                totalPoints,
                newClick: true
            };
        }
        catch (error) {
            logger_1.default.error('Failed to process TikTok click', error, { userId, userName, clickedUrl });
            return { success: false, pointsAwarded: 0, totalPoints: 0, newClick: false };
        }
    }
    async recordTikTokClick(userId, userName, clickedUrl, points) {
        await this.prisma.userActivity.create({
            data: {
                userId: BigInt(userId),
                username: userName.split(' ')[0],
                firstName: userName,
                lastName: null,
                chatId: BigInt(0),
                chatTitle: 'TikTok Click',
                action: 'APPROVED',
                timestamp: new Date(),
                metadata: {
                    type: 'tiktok_click',
                    userName,
                    clickedUrl,
                    pointsAwarded: points
                }
            }
        });
    }
    async getUserTotalPoints(userId) {
        try {
            const activities = await this.prisma.userActivity.findMany({
                where: {
                    userId: BigInt(userId),
                    action: 'APPROVED'
                },
                select: {
                    metadata: true
                }
            });
            let totalPoints = 0;
            const [defaultTikTokPoints, defaultReferralPoints] = await Promise.all([
                this.getTikTokPoints(),
                this.getReferralPoints()
            ]);
            activities.forEach(activity => {
                const metadata = activity.metadata;
                if (metadata?.type === 'tiktok_click') {
                    totalPoints += metadata?.pointsAwarded || defaultTikTokPoints;
                }
                else if (metadata?.type === 'referral_joined') {
                    totalPoints += metadata?.pointsAwarded || defaultReferralPoints;
                }
            });
            return totalPoints;
        }
        catch (error) {
            logger_1.default.error('Failed to calculate user total points', error, { userId });
            return 0;
        }
    }
    generateReferralLink(referralCode, channelUsername) {
        const baseUrl = channelUsername ? `https://t.me/${channelUsername}` : 'https://t.me/your_channel';
        return `${baseUrl}?start=${referralCode}`;
    }
    extractTikTokUrl(messageText) {
        const tiktokRegex = /(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[\w\-\._~:\/\?#[\]@!\$&'\(\)\*\+,;=]*/gi;
        const match = messageText.match(tiktokRegex);
        return match ? match[0] : null;
    }
    isTikTokUrl(url) {
        const tiktokRegex = /(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)/i;
        return tiktokRegex.test(url);
    }
    async getUserClickHistory(userId) {
        try {
            const activities = await this.prisma.userActivity.findMany({
                where: {
                    userId: BigInt(userId),
                    action: 'APPROVED'
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });
            return activities
                .filter(activity => {
                const metadata = activity.metadata;
                return metadata?.type === 'tiktok_click';
            })
                .map(activity => ({
                userId: Number(activity.userId),
                userName: activity.metadata?.userName || activity.firstName,
                clickedUrl: activity.metadata?.clickedUrl || '',
                timestamp: activity.timestamp,
                pointsAwarded: activity.metadata?.pointsAwarded || 3
            }));
        }
        catch (error) {
            logger_1.default.error('Failed to get user click history', error, { userId });
            return [];
        }
    }
    async getLeaderboard(limit = 10) {
        try {
            const activities = await this.prisma.userActivity.findMany({
                where: {
                    action: 'APPROVED'
                },
                select: {
                    userId: true,
                    metadata: true
                }
            });
            const userStats = new Map();
            const [defaultTikTokPoints, defaultReferralPoints] = await Promise.all([
                this.getTikTokPoints(),
                this.getReferralPoints()
            ]);
            activities.forEach(activity => {
                const metadata = activity.metadata;
                const userId = Number(activity.userId);
                const current = userStats.get(userId) || { totalPoints: 0, clickCount: 0 };
                if (metadata?.type === 'tiktok_click') {
                    current.totalPoints += metadata?.pointsAwarded || defaultTikTokPoints;
                    current.clickCount += 1;
                }
                else if (metadata?.type === 'referral_joined') {
                    current.totalPoints += metadata?.pointsAwarded || defaultReferralPoints;
                }
                userStats.set(userId, current);
            });
            return Array.from(userStats.entries())
                .map(([userId, stats]) => ({ userId, ...stats }))
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .slice(0, limit);
        }
        catch (error) {
            logger_1.default.error('Failed to get leaderboard', error);
            return [];
        }
    }
    checkClickRateLimit(userId) {
        return cache_1.default.checkRateLimit(`tiktok_rate:${userId}`, 5, 300);
    }
}
exports.TikTokService = TikTokService;
exports.default = TikTokService.getInstance();
//# sourceMappingURL=TikTokService.js.map