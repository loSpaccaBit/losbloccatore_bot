import logger from '../utils/logger';
import cache from '../utils/cache';
import messageService from './MessageService';
import { PrismaClient } from '@prisma/client';

export interface TikTokClickData {
  userId: number;
  userName: string;
  clickedUrl: string;
  timestamp: Date;
  pointsAwarded: number;
}

export class TikTokService {
  private static instance: TikTokService;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): TikTokService {
    if (!TikTokService.instance) {
      TikTokService.instance = new TikTokService();
    }
    return TikTokService.instance;
  }

  /**
   * Get TikTok points from settings
   */
  private async getTikTokPoints(): Promise<number> {
    const points = await messageService.getSetting('POINTS_PER_TIKTOK', '3');
    return parseInt(points) || 3;
  }

  /**
   * Get referral points from settings
   */
  private async getReferralPoints(): Promise<number> {
    const points = await messageService.getSetting('POINTS_PER_REFERRAL', '2');
    return parseInt(points) || 2;
  }

  /**
   * Process TikTok link click and award points
   * @param userId User ID who clicked
   * @param userName User name
   * @param clickedUrl The TikTok URL that was clicked
   * @returns Object with success status, points awarded, and total points
   */
  async processTikTokClick(
    userId: number, 
    userName: string, 
    clickedUrl: string
  ): Promise<{ success: boolean; pointsAwarded: number; totalPoints: number; newClick: boolean }> {
    
    const cacheKey = `tiktok_click:${userId}:${clickedUrl}`;
    
    // Check if this specific URL was already clicked by this user
    if (cache.get(cacheKey)) {
      logger.debug('TikTok URL already clicked by user', { userId, userName, clickedUrl });
      const totalPoints = await this.getUserTotalPoints(userId);
      return { success: false, pointsAwarded: 0, totalPoints, newClick: false };
    }

    try {
      // Get points from configuration
      const tikTokPoints = await this.getTikTokPoints();
      
      // Record the click in database
      await this.recordTikTokClick(userId, userName, clickedUrl, tikTokPoints);
      
      // Cache the click to prevent duplicates (24 hour expiry)
      cache.set(cacheKey, true, 86400);
      
      // Get updated total points
      const totalPoints = await this.getUserTotalPoints(userId);
      
      logger.info('TikTok click processed successfully', {
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

    } catch (error) {
      logger.error('Failed to process TikTok click', error as Error, { userId, userName, clickedUrl });
      return { success: false, pointsAwarded: 0, totalPoints: 0, newClick: false };
    }
  }

  /**
   * Record TikTok click in database
   */
  private async recordTikTokClick(userId: number, userName: string, clickedUrl: string, points: number): Promise<void> {
    await this.prisma.userActivity.create({
      data: {
        userId: BigInt(userId),
        username: userName.split(' ')[0], // Username if available
        firstName: userName,
        lastName: null,
        chatId: BigInt(0), // Use 0 for TikTok clicks (not chat-specific)
        chatTitle: 'TikTok Click',
        action: 'APPROVED', // Use APPROVED to represent successful TikTok click
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

  /**
   * Get user's total points from all activities
   */
  async getUserTotalPoints(userId: number): Promise<number> {
    try {
      const activities = await this.prisma.userActivity.findMany({
        where: {
          userId: BigInt(userId),
          action: 'APPROVED' // TikTok clicks and referrals are recorded as APPROVED
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
        const metadata = activity.metadata as any;
        if (metadata?.type === 'tiktok_click') {
          // Use points from metadata if available, otherwise use current settings
          totalPoints += metadata?.pointsAwarded || defaultTikTokPoints;
        } else if (metadata?.type === 'referral_joined') {
          totalPoints += metadata?.pointsAwarded || defaultReferralPoints;
        }
      });

      return totalPoints;
      
    } catch (error) {
      logger.error('Failed to calculate user total points', error as Error, { userId });
      return 0;
    }
  }

  /**
   * Generate unique referral link for user using referralCode (consistent with rest of system)
   */
  generateReferralLink(referralCode: string, channelUsername?: string): string {
    const baseUrl = channelUsername ? `https://t.me/${channelUsername}` : 'https://t.me/your_channel';
    
    return `${baseUrl}?start=${referralCode}`;
  }

  /**
   * Extract TikTok URL from message text
   */
  extractTikTokUrl(messageText: string): string | null {
    const tiktokRegex = /(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[\w\-\._~:\/\?#[\]@!\$&'\(\)\*\+,;=]*/gi;
    const match = messageText.match(tiktokRegex);
    return match ? match[0] : null;
  }

  /**
   * Check if URL is a TikTok URL
   */
  isTikTokUrl(url: string): boolean {
    const tiktokRegex = /(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)/i;
    return tiktokRegex.test(url);
  }

  /**
   * Get user's click history
   */
  async getUserClickHistory(userId: number): Promise<TikTokClickData[]> {
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
          const metadata = activity.metadata as any;
          return metadata?.type === 'tiktok_click';
        })
        .map(activity => ({
          userId: Number(activity.userId),
          userName: (activity.metadata as any)?.userName || activity.firstName,
          clickedUrl: (activity.metadata as any)?.clickedUrl || '',
          timestamp: activity.timestamp,
          pointsAwarded: (activity.metadata as any)?.pointsAwarded || 3
        }));

    } catch (error) {
      logger.error('Failed to get user click history', error as Error, { userId });
      return [];
    }
  }

  /**
   * Get leaderboard of top users by points
   */
  async getLeaderboard(limit: number = 10): Promise<Array<{userId: number; totalPoints: number; clickCount: number}>> {
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

      const userStats = new Map<number, {totalPoints: number; clickCount: number}>();
      const [defaultTikTokPoints, defaultReferralPoints] = await Promise.all([
        this.getTikTokPoints(),
        this.getReferralPoints()
      ]);

      activities.forEach(activity => {
        const metadata = activity.metadata as any;
        const userId = Number(activity.userId);
        const current = userStats.get(userId) || { totalPoints: 0, clickCount: 0 };
        
        if (metadata?.type === 'tiktok_click') {
          current.totalPoints += metadata?.pointsAwarded || defaultTikTokPoints;
          current.clickCount += 1;
        } else if (metadata?.type === 'referral_joined') {
          current.totalPoints += metadata?.pointsAwarded || defaultReferralPoints;
        }
        
        userStats.set(userId, current);
      });

      return Array.from(userStats.entries())
        .map(([userId, stats]) => ({ userId, ...stats }))
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, limit);

    } catch (error) {
      logger.error('Failed to get leaderboard', error as Error);
      return [];
    }
  }

  /**
   * Rate limiting for TikTok clicks
   */
  checkClickRateLimit(userId: number): boolean {
    return cache.checkRateLimit(`tiktok_rate:${userId}`, 5, 300); // 5 clicks per 5 minutes
  }
}

export default TikTokService.getInstance();