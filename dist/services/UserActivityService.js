"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivityService = void 0;
const UserActivityRepository_1 = require("../database/repositories/UserActivityRepository");
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importDefault(require("../utils/cache"));
class UserActivityService {
    constructor() {
        this.userActivityRepository = new UserActivityRepository_1.UserActivityRepository();
    }
    async recordJoinRequest(event) {
        try {
            const activityData = {
                userId: BigInt(event.user.id),
                firstName: event.user.first_name,
                action: client_1.UserAction.JOINED,
                chatId: BigInt(event.chat.id),
                chatTitle: event.chat.title,
                metadata: {
                    eventType: 'chat_join_request',
                    date: new Date(event.date * 1000),
                    languageCode: event.user.language_code,
                    isBot: event.user.is_bot
                }
            };
            if (event.user.username) {
                activityData.username = event.user.username;
            }
            if (event.user.last_name) {
                activityData.lastName = event.user.last_name;
            }
            const activity = await this.userActivityRepository.create(activityData);
            cache_1.default.cacheUserAction(event.user.id, client_1.UserAction.JOINED);
            logger_1.default.info('Join request recorded', {
                activityId: activity.id,
                userId: event.user.id,
                username: event.user.username,
                chatId: event.chat.id
            });
            return activity;
        }
        catch (error) {
            logger_1.default.error('Failed to record join request', error, { event });
            throw error;
        }
    }
    async recordApproval(userId, chatId, chatTitle, userInfo) {
        try {
            const recentApproval = await this.userActivityRepository.findRecent(userId, chatId, client_1.UserAction.APPROVED, 5 * 60 * 1000);
            if (recentApproval) {
                logger_1.default.debug('Approval already recorded recently, skipping duplicate', {
                    userId,
                    chatId,
                    recentApprovalId: recentApproval.id,
                    recentApprovalTime: recentApproval.timestamp
                });
                return recentApproval;
            }
            const activityData = {
                userId: BigInt(userId),
                firstName: userInfo.first_name || 'Unknown',
                action: client_1.UserAction.APPROVED,
                chatId: BigInt(chatId),
                chatTitle,
                metadata: {
                    eventType: 'approval',
                    approvedAt: new Date(),
                    languageCode: userInfo.language_code,
                    isBot: userInfo.is_bot || false
                }
            };
            if (userInfo.username) {
                activityData.username = userInfo.username;
            }
            if (userInfo.last_name) {
                activityData.lastName = userInfo.last_name;
            }
            const activity = await this.userActivityRepository.create(activityData);
            cache_1.default.cacheUserAction(userId, client_1.UserAction.APPROVED);
            logger_1.default.info('User approval recorded', {
                activityId: activity.id,
                userId,
                username: userInfo.username,
                chatId
            });
            return activity;
        }
        catch (error) {
            logger_1.default.error('Failed to record approval', error, { userId, chatId });
            throw error;
        }
    }
    async recordUserLeave(memberUpdate) {
        try {
            const user = memberUpdate.new_chat_member.user;
            const activityData = {
                userId: BigInt(user.id),
                firstName: user.first_name,
                action: client_1.UserAction.LEFT,
                chatId: BigInt(memberUpdate.chat.id),
                chatTitle: memberUpdate.chat.title,
                metadata: {
                    eventType: 'member_left',
                    oldStatus: memberUpdate.old_chat_member.status,
                    newStatus: memberUpdate.new_chat_member.status,
                    date: new Date(memberUpdate.date * 1000),
                    languageCode: user.language_code,
                    isBot: user.is_bot
                }
            };
            if (user.username) {
                activityData.username = user.username;
            }
            if (user.last_name) {
                activityData.lastName = user.last_name;
            }
            const activity = await this.userActivityRepository.create(activityData);
            cache_1.default.cacheUserAction(user.id, client_1.UserAction.LEFT);
            logger_1.default.info('User leave recorded', {
                activityId: activity.id,
                userId: user.id,
                username: user.username,
                chatId: memberUpdate.chat.id,
                oldStatus: memberUpdate.old_chat_member.status,
                newStatus: memberUpdate.new_chat_member.status
            });
            return activity;
        }
        catch (error) {
            logger_1.default.error('Failed to record user leave', error, { memberUpdate });
            throw error;
        }
    }
    async recordRejection(userId, chatId, chatTitle, userInfo, reason) {
        try {
            const activityData = {
                userId: BigInt(userId),
                firstName: userInfo.first_name || 'Unknown',
                action: client_1.UserAction.REJECTED,
                chatId: BigInt(chatId),
                chatTitle,
                metadata: {
                    eventType: 'rejection',
                    rejectedAt: new Date(),
                    reason,
                    languageCode: userInfo.language_code,
                    isBot: userInfo.is_bot || false
                }
            };
            if (userInfo.username) {
                activityData.username = userInfo.username;
            }
            if (userInfo.last_name) {
                activityData.lastName = userInfo.last_name;
            }
            const activity = await this.userActivityRepository.create(activityData);
            cache_1.default.cacheUserAction(userId, client_1.UserAction.REJECTED);
            logger_1.default.info('User rejection recorded', {
                activityId: activity.id,
                userId,
                username: userInfo.username,
                chatId,
                reason
            });
            return activity;
        }
        catch (error) {
            logger_1.default.error('Failed to record rejection', error, { userId, chatId, reason });
            throw error;
        }
    }
    async getUserHistory(userId, limit = 50) {
        try {
            const activities = await this.userActivityRepository.findByUserId(BigInt(userId), limit);
            logger_1.default.debug('Retrieved user history', {
                userId,
                activitiesCount: activities.length
            });
            return activities;
        }
        catch (error) {
            logger_1.default.error('Failed to get user history', error, { userId });
            throw error;
        }
    }
    async getChatHistory(chatId, limit = 100) {
        try {
            const activities = await this.userActivityRepository.findByChatId(BigInt(chatId), limit);
            logger_1.default.debug('Retrieved chat history', {
                chatId,
                activitiesCount: activities.length
            });
            return activities;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat history', error, { chatId });
            throw error;
        }
    }
    async getUserStats(userId) {
        try {
            const stats = await this.userActivityRepository.getUserStats(BigInt(userId));
            logger_1.default.debug('Retrieved user stats', {
                userId,
                stats
            });
            return stats;
        }
        catch (error) {
            logger_1.default.error('Failed to get user stats', error, { userId });
            throw error;
        }
    }
    async getChatStats(chatId) {
        try {
            const stats = await this.userActivityRepository.getChatStats(BigInt(chatId));
            logger_1.default.debug('Retrieved chat stats', {
                chatId,
                stats
            });
            return stats;
        }
        catch (error) {
            logger_1.default.error('Failed to get chat stats', error, { chatId });
            throw error;
        }
    }
    async getRecentActivities(hours = 24, limit = 100) {
        try {
            const activities = await this.userActivityRepository.getRecentActivities(hours, limit);
            logger_1.default.debug('Retrieved recent activities', {
                hours,
                activitiesCount: activities.length
            });
            return activities;
        }
        catch (error) {
            logger_1.default.error('Failed to get recent activities', error, { hours });
            throw error;
        }
    }
    async cleanupOldActivities(daysOld = 90) {
        try {
            const deletedCount = await this.userActivityRepository.deleteOldActivities(daysOld);
            if (deletedCount > 0) {
                logger_1.default.info('Cleaned up old activities', {
                    deletedCount,
                    daysOld
                });
            }
            return deletedCount;
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup old activities', error, { daysOld });
            throw error;
        }
    }
    async hasUserJoinedBefore(userId, chatId) {
        try {
            const cachedAction = cache_1.default.getUserAction(userId, client_1.UserAction.JOINED);
            if (cachedAction) {
                return true;
            }
            const activities = await this.userActivityRepository.findByUserId(BigInt(userId), 10);
            const hasJoined = activities.some(activity => activity.chatId === BigInt(chatId) &&
                (activity.action === client_1.UserAction.JOINED || activity.action === client_1.UserAction.APPROVED));
            if (hasJoined) {
                cache_1.default.cacheUserAction(userId, client_1.UserAction.JOINED);
            }
            return hasJoined;
        }
        catch (error) {
            logger_1.default.error('Failed to check if user joined before', error, { userId, chatId });
            return false;
        }
    }
    async isUserCurrentlyInChat(userId, chatId) {
        try {
            const recentActivities = await this.userActivityRepository.findByUserId(BigInt(userId), 5);
            const chatActivities = recentActivities.filter(activity => activity.chatId === BigInt(chatId));
            if (chatActivities.length === 0) {
                return false;
            }
            const mostRecentActivity = chatActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            return (mostRecentActivity.action === client_1.UserAction.JOINED || mostRecentActivity.action === client_1.UserAction.APPROVED);
        }
        catch (error) {
            logger_1.default.error('Failed to check if user is currently in chat', error, { userId, chatId });
            return false;
        }
    }
    async getActivityCount() {
        try {
            return await this.userActivityRepository.getTotalCount();
        }
        catch (error) {
            logger_1.default.error('Failed to get activity count', error);
            return 0;
        }
    }
    async getRecentActivityCount(hours) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setHours(cutoffDate.getHours() - hours);
            return await this.userActivityRepository.getCountSince(cutoffDate);
        }
        catch (error) {
            logger_1.default.error('Failed to get recent activity count', error, { hours });
            return 0;
        }
    }
    async cleanupOldRecords(cutoffDate) {
        try {
            const deletedCount = await this.userActivityRepository.deleteOlderThan(cutoffDate);
            logger_1.default.info('Old activity records cleaned up', {
                deletedCount,
                cutoffDate: cutoffDate.toISOString()
            });
            return deletedCount;
        }
        catch (error) {
            logger_1.default.error('Failed to cleanup old records', error, { cutoffDate });
            return 0;
        }
    }
}
exports.UserActivityService = UserActivityService;
//# sourceMappingURL=UserActivityService.js.map