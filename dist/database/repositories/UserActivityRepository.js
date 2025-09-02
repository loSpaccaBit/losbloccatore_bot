"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivityRepository = void 0;
const client_1 = require("@prisma/client");
const UserActivity_1 = require("../../models/UserActivity");
const connection_1 = __importDefault(require("../connection"));
const logger_1 = __importDefault(require("../../utils/logger"));
class UserActivityRepository {
    constructor() {
        this.prisma = null;
    }
    getPrisma() {
        if (!this.prisma) {
            this.prisma = connection_1.default.getPrisma();
        }
        return this.prisma;
    }
    async create(activityData) {
        try {
            const prisma = this.getPrisma();
            const createData = {
                userId: activityData.userId,
                username: activityData.username || null,
                firstName: activityData.firstName,
                lastName: activityData.lastName || null,
                action: activityData.action,
                chatId: activityData.chatId,
                chatTitle: activityData.chatTitle
            };
            if (activityData.metadata) {
                createData.metadata = activityData.metadata;
            }
            const savedActivity = await prisma.userActivity.create({
                data: createData
            });
            logger_1.default.debug('User activity created', {
                id: savedActivity.id,
                userId: savedActivity.userId,
                action: savedActivity.action
            });
            return new UserActivity_1.UserActivity(savedActivity);
        }
        catch (error) {
            logger_1.default.error('Failed to create user activity', error, { activityData });
            throw error;
        }
    }
    async findById(id) {
        try {
            const prisma = this.getPrisma();
            const activity = await prisma.userActivity.findUnique({ where: { id } });
            return activity ? new UserActivity_1.UserActivity(activity) : null;
        }
        catch (error) {
            logger_1.default.error('Failed to find user activity by ID', error, { id });
            throw error;
        }
    }
    async findByUserId(userId, limit = 50) {
        try {
            const prisma = this.getPrisma();
            const activities = await prisma.userActivity.findMany({
                where: { userId },
                orderBy: { timestamp: 'desc' },
                take: limit
            });
            return activities.map(activity => new UserActivity_1.UserActivity(activity));
        }
        catch (error) {
            logger_1.default.error('Failed to find user activities by user ID', error, { userId });
            throw error;
        }
    }
    async findByChatId(chatId, limit = 100) {
        try {
            const prisma = this.getPrisma();
            const activities = await prisma.userActivity.findMany({
                where: { chatId },
                orderBy: { timestamp: 'desc' },
                take: limit
            });
            return activities.map(activity => new UserActivity_1.UserActivity(activity));
        }
        catch (error) {
            logger_1.default.error('Failed to find user activities by chat ID', error, { chatId });
            throw error;
        }
    }
    async findByAction(action, limit = 100) {
        try {
            const prisma = this.getPrisma();
            const activities = await prisma.userActivity.findMany({
                where: { action },
                orderBy: { timestamp: 'desc' },
                take: limit
            });
            return activities.map(activity => new UserActivity_1.UserActivity(activity));
        }
        catch (error) {
            logger_1.default.error('Failed to find user activities by action', error, { action });
            throw error;
        }
    }
    async findByDateRange(startDate, endDate) {
        try {
            const prisma = this.getPrisma();
            const activities = await prisma.userActivity.findMany({
                where: {
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: { timestamp: 'desc' }
            });
            return activities.map(activity => new UserActivity_1.UserActivity(activity));
        }
        catch (error) {
            logger_1.default.error('Failed to find user activities by date range', error, { startDate, endDate });
            throw error;
        }
    }
    async getUserStats(userId) {
        try {
            const activities = await this.findByUserId(userId);
            const stats = {
                totalActivities: activities.length,
                joinCount: activities.filter(a => a.action === client_1.UserAction.JOINED).length,
                leaveCount: activities.filter(a => a.action === client_1.UserAction.LEFT).length,
                approvedCount: activities.filter(a => a.action === client_1.UserAction.APPROVED).length,
                rejectedCount: activities.filter(a => a.action === client_1.UserAction.REJECTED).length,
                lastActivity: activities[0]?.timestamp
            };
            return stats;
        }
        catch (error) {
            logger_1.default.error('Failed to get user stats', error, { userId });
            throw error;
        }
    }
    async getChatStats(chatId) {
        try {
            const activities = await this.findByChatId(chatId);
            const uniqueUserIds = new Set(activities.map(a => a.userId));
            const stats = {
                totalActivities: activities.length,
                uniqueUsers: uniqueUserIds.size,
                joinCount: activities.filter(a => a.action === client_1.UserAction.JOINED).length,
                leaveCount: activities.filter(a => a.action === client_1.UserAction.LEFT).length,
                approvedCount: activities.filter(a => a.action === client_1.UserAction.APPROVED).length,
                rejectedCount: activities.filter(a => a.action === client_1.UserAction.REJECTED).length,
                lastActivity: activities[0]?.timestamp
            };
            return stats;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat stats', error, { chatId });
            throw error;
        }
    }
    async findRecent(userId, chatId, action, withinMs) {
        try {
            const prisma = this.getPrisma();
            const since = new Date(Date.now() - withinMs);
            const activity = await prisma.userActivity.findFirst({
                where: {
                    userId: BigInt(userId),
                    chatId: BigInt(chatId),
                    action: action,
                    timestamp: {
                        gt: since
                    }
                },
                orderBy: { timestamp: 'desc' }
            });
            return activity ? new UserActivity_1.UserActivity(activity) : null;
        }
        catch (error) {
            logger_1.default.error('Failed to find recent activity', error, { userId, chatId, action, withinMs });
            throw error;
        }
    }
    async getRecentActivities(hours = 24, limit = 100) {
        try {
            const prisma = this.getPrisma();
            const since = new Date(Date.now() - hours * 60 * 60 * 1000);
            const activities = await prisma.userActivity.findMany({
                where: {
                    timestamp: {
                        gt: since
                    }
                },
                orderBy: { timestamp: 'desc' },
                take: limit
            });
            return activities.map(activity => new UserActivity_1.UserActivity(activity));
        }
        catch (error) {
            logger_1.default.error('Failed to get recent activities', error, { hours });
            throw error;
        }
    }
    async deleteOldActivities(daysOld = 90) {
        try {
            const prisma = this.getPrisma();
            const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
            const result = await prisma.userActivity.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });
            const deletedCount = result.count;
            if (deletedCount > 0) {
                logger_1.default.info('Deleted old user activities', {
                    deletedCount,
                    cutoffDate,
                    daysOld
                });
            }
            return deletedCount;
        }
        catch (error) {
            logger_1.default.error('Failed to delete old activities', error, { daysOld });
            throw error;
        }
    }
    async getTotalCount() {
        try {
            const count = await this.getPrisma().userActivity.count();
            return count;
        }
        catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logger_1.default.error('Failed to get total activity count', errorObj);
            throw error;
        }
    }
    async getCountSince(date) {
        try {
            const count = await this.getPrisma().userActivity.count({
                where: {
                    timestamp: {
                        gte: date
                    }
                }
            });
            return count;
        }
        catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logger_1.default.error('Failed to get activity count since date', errorObj, { date });
            throw error;
        }
    }
    async deleteOlderThan(cutoffDate) {
        try {
            const result = await this.getPrisma().userActivity.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate
                    }
                }
            });
            return result.count;
        }
        catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logger_1.default.error('Failed to delete activities older than date', errorObj, { cutoffDate });
            throw error;
        }
    }
}
exports.UserActivityRepository = UserActivityRepository;
//# sourceMappingURL=UserActivityRepository.js.map