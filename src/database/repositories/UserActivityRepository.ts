import { PrismaClient, UserAction } from '@prisma/client';
import { UserActivity, UserActivityData } from '../../models/UserActivity';
import databaseConnection from '../connection';
import logger from '../../utils/logger';

export class UserActivityRepository {
  private prisma: PrismaClient | null = null;

  constructor() {
    // Prisma client will be initialized lazily when first accessed
  }

  private getPrisma(): PrismaClient {
    if (!this.prisma) {
      this.prisma = databaseConnection.getPrisma();
    }
    return this.prisma;
  }

  async create(activityData: UserActivityData): Promise<UserActivity> {
    try {
      const prisma = this.getPrisma();
      const createData: any = {
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
      
      logger.debug('User activity created', {
        id: savedActivity.id,
        userId: savedActivity.userId,
        action: savedActivity.action
      });

      return new UserActivity(savedActivity);
    } catch (error) {
      logger.error('Failed to create user activity', error, { activityData });
      throw error;
    }
  }

  async findById(id: number): Promise<UserActivity | null> {
    try {
      const prisma = this.getPrisma();
      const activity = await prisma.userActivity.findUnique({ where: { id } });
      return activity ? new UserActivity(activity) : null;
    } catch (error) {
      logger.error('Failed to find user activity by ID', error, { id });
      throw error;
    }
  }

  async findByUserId(userId: bigint, limit: number = 50): Promise<UserActivity[]> {
    try {
      const prisma = this.getPrisma();
      const activities = await prisma.userActivity.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit
      });
      return activities.map(activity => new UserActivity(activity));
    } catch (error) {
      logger.error('Failed to find user activities by user ID', error, { userId });
      throw error;
    }
  }

  async findByChatId(chatId: bigint, limit: number = 100): Promise<UserActivity[]> {
    try {
      const prisma = this.getPrisma();
      const activities = await prisma.userActivity.findMany({
        where: { chatId },
        orderBy: { timestamp: 'desc' },
        take: limit
      });
      return activities.map(activity => new UserActivity(activity));
    } catch (error) {
      logger.error('Failed to find user activities by chat ID', error, { chatId });
      throw error;
    }
  }

  async findByAction(action: UserAction, limit: number = 100): Promise<UserActivity[]> {
    try {
      const prisma = this.getPrisma();
      const activities = await prisma.userActivity.findMany({
        where: { action },
        orderBy: { timestamp: 'desc' },
        take: limit
      });
      return activities.map(activity => new UserActivity(activity));
    } catch (error) {
      logger.error('Failed to find user activities by action', error, { action });
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<UserActivity[]> {
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
      return activities.map(activity => new UserActivity(activity));
    } catch (error) {
      logger.error('Failed to find user activities by date range', error, { startDate, endDate });
      throw error;
    }
  }

  async getUserStats(userId: bigint): Promise<{
    totalActivities: number;
    joinCount: number;
    leaveCount: number;
    approvedCount: number;
    rejectedCount: number;
    lastActivity?: Date;
  }> {
    try {
      const activities = await this.findByUserId(userId);
      
      const stats = {
        totalActivities: activities.length,
        joinCount: activities.filter(a => a.action === UserAction.JOINED).length,
        leaveCount: activities.filter(a => a.action === UserAction.LEFT).length,
        approvedCount: activities.filter(a => a.action === UserAction.APPROVED).length,
        rejectedCount: activities.filter(a => a.action === UserAction.REJECTED).length,
        lastActivity: activities[0]?.timestamp
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get user stats', error, { userId });
      throw error;
    }
  }

  async getChatStats(chatId: bigint): Promise<{
    totalActivities: number;
    uniqueUsers: number;
    joinCount: number;
    leaveCount: number;
    approvedCount: number;
    rejectedCount: number;
    lastActivity?: Date;
  }> {
    try {
      const activities = await this.findByChatId(chatId);
      const uniqueUserIds = new Set(activities.map(a => a.userId));
      
      const stats = {
        totalActivities: activities.length,
        uniqueUsers: uniqueUserIds.size,
        joinCount: activities.filter(a => a.action === UserAction.JOINED).length,
        leaveCount: activities.filter(a => a.action === UserAction.LEFT).length,
        approvedCount: activities.filter(a => a.action === UserAction.APPROVED).length,
        rejectedCount: activities.filter(a => a.action === UserAction.REJECTED).length,
        lastActivity: activities[0]?.timestamp
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get chat stats', error, { chatId });
      throw error;
    }
  }

  async findRecent(userId: number, chatId: number, action: UserAction, withinMs: number): Promise<UserActivity | null> {
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
      
      return activity ? new UserActivity(activity) : null;
    } catch (error) {
      logger.error('Failed to find recent activity', error, { userId, chatId, action, withinMs });
      throw error;
    }
  }

  async getRecentActivities(hours: number = 24, limit: number = 100): Promise<UserActivity[]> {
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
      return activities.map(activity => new UserActivity(activity));
    } catch (error) {
      logger.error('Failed to get recent activities', error, { hours });
      throw error;
    }
  }

  async deleteOldActivities(daysOld: number = 90): Promise<number> {
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
        logger.info('Deleted old user activities', {
          deletedCount,
          cutoffDate,
          daysOld
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete old activities', error, { daysOld });
      throw error;
    }
  }

  /**
   * Get total count of all activities
   */
  async getTotalCount(): Promise<number> {
    try {
      const count = await this.getPrisma().userActivity.count();
      return count;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get total activity count', errorObj);
      throw error;
    }
  }

  /**
   * Get count of activities since a specific date
   */
  async getCountSince(date: Date): Promise<number> {
    try {
      const count = await this.getPrisma().userActivity.count({
        where: {
          timestamp: {
            gte: date
          }
        }
      });
      return count;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get activity count since date', errorObj, { date });
      throw error;
    }
  }

  /**
   * Delete activities older than specified date
   */
  async deleteOlderThan(cutoffDate: Date): Promise<number> {
    try {
      const result = await this.getPrisma().userActivity.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });
      
      return result.count;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to delete activities older than date', errorObj, { cutoffDate });
      throw error;
    }
  }
}