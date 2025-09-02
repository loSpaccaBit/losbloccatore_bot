import { UserActivityRepository } from '../database/repositories/UserActivityRepository';
import { UserActivity, UserActivityData } from '../models/UserActivity';
import { TelegramUser, ChatJoinRequestEvent, ChatMemberUpdate } from '../types/index';
import { UserAction } from '@prisma/client';
import logger from '../utils/logger';
import cache from '../utils/cache';

export class UserActivityService {
  private userActivityRepository: UserActivityRepository;

  constructor() {
    this.userActivityRepository = new UserActivityRepository();
  }

  async recordJoinRequest(event: ChatJoinRequestEvent): Promise<UserActivity> {
    try {
      const activityData: UserActivityData = {
        userId: BigInt(event.user.id),
        firstName: event.user.first_name,
        action: UserAction.JOINED,
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

      // Cache the user action for quick lookups
      cache.cacheUserAction(event.user.id, UserAction.JOINED);

      logger.info('Join request recorded', {
        activityId: activity.id,
        userId: event.user.id,
        username: event.user.username,
        chatId: event.chat.id
      });

      return activity;
    } catch (error) {
      logger.error('Failed to record join request', error as Error, { event });
      throw error;
    }
  }

  async recordApproval(userId: number, chatId: number, chatTitle: string, userInfo: Partial<TelegramUser>): Promise<UserActivity> {
    try {
      // Check if approval was already recorded recently (within 5 minutes) to avoid duplicates
      const recentApproval = await this.userActivityRepository.findRecent(
        userId, 
        chatId, 
        UserAction.APPROVED,
        5 * 60 * 1000 // 5 minutes
      );

      if (recentApproval) {
        logger.debug('Approval already recorded recently, skipping duplicate', {
          userId,
          chatId,
          recentApprovalId: recentApproval.id,
          recentApprovalTime: recentApproval.timestamp
        });
        return recentApproval;
      }

      const activityData: UserActivityData = {
        userId: BigInt(userId),
        firstName: userInfo.first_name || 'Unknown',
        action: UserAction.APPROVED,
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

      // Cache the approval
      cache.cacheUserAction(userId, UserAction.APPROVED);

      logger.info('User approval recorded', {
        activityId: activity.id,
        userId,
        username: userInfo.username,
        chatId
      });

      return activity;
    } catch (error) {
      logger.error('Failed to record approval', error as Error, { userId, chatId });
      throw error;
    }
  }

  async recordUserLeave(memberUpdate: ChatMemberUpdate): Promise<UserActivity> {
    try {
      const user = memberUpdate.new_chat_member.user;
      
      const activityData: UserActivityData = {
        userId: BigInt(user.id),
        firstName: user.first_name,
        action: UserAction.LEFT,
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

      // Cache the user action
      cache.cacheUserAction(user.id, UserAction.LEFT);

      logger.info('User leave recorded', {
        activityId: activity.id,
        userId: user.id,
        username: user.username,
        chatId: memberUpdate.chat.id,
        oldStatus: memberUpdate.old_chat_member.status,
        newStatus: memberUpdate.new_chat_member.status
      });

      return activity;
    } catch (error) {
      logger.error('Failed to record user leave', error as Error, { memberUpdate });
      throw error;
    }
  }

  async recordRejection(userId: number, chatId: number, chatTitle: string, userInfo: Partial<TelegramUser>, reason?: string): Promise<UserActivity> {
    try {
      const activityData: UserActivityData = {
        userId: BigInt(userId),
        firstName: userInfo.first_name || 'Unknown',
        action: UserAction.REJECTED,
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

      // Cache the rejection
      cache.cacheUserAction(userId, UserAction.REJECTED);

      logger.info('User rejection recorded', {
        activityId: activity.id,
        userId,
        username: userInfo.username,
        chatId,
        reason
      });

      return activity;
    } catch (error) {
      logger.error('Failed to record rejection', error as Error, { userId, chatId, reason });
      throw error;
    }
  }

  async getUserHistory(userId: number, limit: number = 50): Promise<UserActivity[]> {
    try {
      const activities = await this.userActivityRepository.findByUserId(BigInt(userId), limit);
      
      logger.debug('Retrieved user history', {
        userId,
        activitiesCount: activities.length
      });

      return activities;
    } catch (error) {
      logger.error('Failed to get user history', error as Error, { userId });
      throw error;
    }
  }

  async getChatHistory(chatId: number, limit: number = 100): Promise<UserActivity[]> {
    try {
      const activities = await this.userActivityRepository.findByChatId(BigInt(chatId), limit);
      
      logger.debug('Retrieved chat history', {
        chatId,
        activitiesCount: activities.length
      });

      return activities;
    } catch (error) {
      logger.error('Failed to get chat history', error as Error, { chatId });
      throw error;
    }
  }

  async getUserStats(userId: number): Promise<{
    totalActivities: number;
    joinCount: number;
    leaveCount: number;
    approvedCount: number;
    rejectedCount: number;
    lastActivity?: Date;
  }> {
    try {
      const stats = await this.userActivityRepository.getUserStats(BigInt(userId));
      
      logger.debug('Retrieved user stats', {
        userId,
        stats
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get user stats', error as Error, { userId });
      throw error;
    }
  }

  async getChatStats(chatId: number): Promise<{
    totalActivities: number;
    uniqueUsers: number;
    joinCount: number;
    leaveCount: number;
    approvedCount: number;
    rejectedCount: number;
    lastActivity?: Date;
  }> {
    try {
      const stats = await this.userActivityRepository.getChatStats(BigInt(chatId));
      
      logger.debug('Retrieved chat stats', {
        chatId,
        stats
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get chat stats', error as Error, { chatId });
      throw error;
    }
  }

  async getRecentActivities(hours: number = 24, limit: number = 100): Promise<UserActivity[]> {
    try {
      const activities = await this.userActivityRepository.getRecentActivities(hours, limit);
      
      logger.debug('Retrieved recent activities', {
        hours,
        activitiesCount: activities.length
      });

      return activities;
    } catch (error) {
      logger.error('Failed to get recent activities', error as Error, { hours });
      throw error;
    }
  }

  async cleanupOldActivities(daysOld: number = 90): Promise<number> {
    try {
      const deletedCount = await this.userActivityRepository.deleteOldActivities(daysOld);
      
      if (deletedCount > 0) {
        logger.info('Cleaned up old activities', {
          deletedCount,
          daysOld
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old activities', error as Error, { daysOld });
      throw error;
    }
  }

  async hasUserJoinedBefore(userId: number, chatId: number): Promise<boolean> {
    try {
      // Check cache first
      const cachedAction = cache.getUserAction(userId, UserAction.JOINED);
      if (cachedAction) {
        return true;
      }

      // Check database
      const activities = await this.userActivityRepository.findByUserId(BigInt(userId), 10);
      const hasJoined = activities.some(activity => 
        activity.chatId === BigInt(chatId) && 
        (activity.action === UserAction.JOINED || activity.action === UserAction.APPROVED)
      );

      if (hasJoined) {
        cache.cacheUserAction(userId, UserAction.JOINED);
      }

      return hasJoined;
    } catch (error) {
      logger.error('Failed to check if user joined before', error as Error, { userId, chatId });
      return false;
    }
  }

  async isUserCurrentlyInChat(userId: number, chatId: number): Promise<boolean> {
    try {
      const recentActivities = await this.userActivityRepository.findByUserId(BigInt(userId), 5);
      const chatActivities = recentActivities.filter(activity => activity.chatId === BigInt(chatId));
      
      if (chatActivities.length === 0) {
        return false;
      }

      // Sort by timestamp and get the most recent activity for this chat
      const mostRecentActivity = chatActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      // User is in chat if most recent action was join/approved and not left
      return (mostRecentActivity.action === UserAction.JOINED || mostRecentActivity.action === UserAction.APPROVED);
    } catch (error) {
      logger.error('Failed to check if user is currently in chat', error as Error, { userId, chatId });
      return false;
    }
  }

  /**
   * Get total count of all activities for system statistics
   */
  async getActivityCount(): Promise<number> {
    try {
      return await this.userActivityRepository.getTotalCount();
    } catch (error) {
      logger.error('Failed to get activity count', error as Error);
      return 0;
    }
  }

  /**
   * Get count of recent activities within specified hours
   */
  async getRecentActivityCount(hours: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);
      
      return await this.userActivityRepository.getCountSince(cutoffDate);
    } catch (error) {
      logger.error('Failed to get recent activity count', error as Error, { hours });
      return 0;
    }
  }

  /**
   * Clean up old activity records older than specified date
   */
  async cleanupOldRecords(cutoffDate: Date): Promise<number> {
    try {
      const deletedCount = await this.userActivityRepository.deleteOlderThan(cutoffDate);
      
      logger.info('Old activity records cleaned up', {
        deletedCount,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old records', error as Error, { cutoffDate });
      return 0;
    }
  }
}