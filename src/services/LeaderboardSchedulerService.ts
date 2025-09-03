import * as cron from 'node-cron';
import { LeaderboardImageService } from './LeaderboardImageService';
import { TelegramService } from './TelegramService';
import logger from '../utils/logger';
import config from '../config';

export class LeaderboardSchedulerService {
  private isRunning: boolean = false;
  private scheduledTask: cron.ScheduledTask | null = null;
  private chatId: number;
  private adminUserId: number | null = null;
  private cronExpression: string;
  private telegramService: TelegramService | null = null;
  private leaderboardImageService: LeaderboardImageService | null = null;

  constructor(chatId?: number, cronExpression?: string) {
    this.chatId = chatId || Number(config.channelId);
    // Set admin user ID from config if available
    this.adminUserId = config.adminUserId ? Number(config.adminUserId) : null;
    // Default: every hour at minute 0 (e.g., 13:00, 14:00, 15:00...)
    this.cronExpression = cronExpression || '0 * * * *';
  }

  private getTelegramService(): TelegramService {
    if (!this.telegramService) {
      this.telegramService = new TelegramService();
    }
    return this.telegramService;
  }

  private getLeaderboardImageService(): LeaderboardImageService {
    if (!this.leaderboardImageService) {
      this.leaderboardImageService = new LeaderboardImageService();
    }
    return this.leaderboardImageService;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Leaderboard scheduler is already running');
      return;
    }

    if (!this.adminUserId) {
      logger.error('Cannot start leaderboard scheduler: ADMIN_USER_ID not configured');
      return;
    }

    logger.info('Starting leaderboard scheduler', {
      chatId: this.chatId,
      adminUserId: this.adminUserId,
      cronExpression: this.cronExpression,
      timezone: 'Europe/Rome'
    });

    // Validate cron expression first
    if (!cron.validate(this.cronExpression)) {
      logger.error('Invalid cron expression', { cronExpression: this.cronExpression });
      return;
    }

    try {
      this.scheduledTask = cron.schedule(
        this.cronExpression,
        async () => {
          logger.info('Cron job triggered - generating leaderboard');
          await this.generateAndSendLeaderboard();
        },
        {
          timezone: 'Europe/Rome'
        }
      );

      this.isRunning = true;
      logger.info('Leaderboard scheduler started successfully', {
        nextRun: this.scheduledTask ? 'scheduled' : 'unknown'
      });
    } catch (error) {
      logger.error('Failed to start leaderboard scheduler', error as Error);
    }
  }

  stop(): void {
    if (!this.isRunning || !this.scheduledTask) {
      logger.warn('Leaderboard scheduler is not running');
      return;
    }

    this.scheduledTask.stop();
    this.scheduledTask = null;
    this.isRunning = false;
    logger.info('Leaderboard scheduler stopped');
  }

  async generateAndSendLeaderboard(): Promise<void> {
    try {
      if (!this.adminUserId) {
        logger.error('Cannot send leaderboard: admin user ID not configured');
        return;
      }

      logger.info('Generating and sending scheduled leaderboard to admin', { 
        chatId: this.chatId,
        adminUserId: this.adminUserId 
      });

      // Use the actual chatId (negative for channels) for database queries
      const dbChatId = this.chatId;

      // Generate the leaderboard image
      const imagePath = await this.getLeaderboardImageService().generateLeaderboardImage(dbChatId);

      // Get leaderboard data for the message text (top 5 only)
      const leaderboardData = await this.getLeaderboardImageService().getLeaderboardData(dbChatId, 5);

      // Create simple message text with top 5
      let messageText: string;

      if (leaderboardData.length === 0) {
        messageText = `🏆 *CLASSIFICA TOP 5*\n\n🚫 Nessun partecipante`;
      } else {
        messageText = `🏆 *CLASSIFICA TOP 5*\n\n`;

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

        leaderboardData.forEach((participant, index) => {
          messageText += `${medals[index]} ${participant.username} - ${participant.points} punti\n`;
        });
      }

      // Send the image with caption to admin privately
      await this.getTelegramService().sendPhoto(
        this.adminUserId,
        imagePath,
        messageText
      );

      logger.info('Scheduled leaderboard sent to admin successfully', {
        adminUserId: this.adminUserId,
        dbChatId,
        participantCount: leaderboardData.length,
        imagePath
      });

    } catch (error) {
      logger.error('Failed to generate and send scheduled leaderboard to admin', error as Error, {
        chatId: this.chatId,
        adminUserId: this.adminUserId
      });
    }
  }

  async sendLeaderboardNow(): Promise<void> {
    logger.info('Manual leaderboard generation requested', { chatId: this.chatId });
    await this.generateAndSendLeaderboard();
  }

  updateSchedule(cronExpression: string): void {
    logger.info('Updating leaderboard schedule', {
      oldSchedule: this.cronExpression,
      newSchedule: cronExpression
    });

    if (this.isRunning) {
      this.stop();
    }

    this.cronExpression = cronExpression;
    this.start();
  }

  updateChatId(chatId: number): void {
    logger.info('Updating leaderboard chat ID', {
      oldChatId: this.chatId,
      newChatId: chatId
    });

    this.chatId = chatId;
  }

  getStatus(): {
    isRunning: boolean;
    chatId: number;
    cronExpression: string;
    adminUserId: number | null;
  } {
    return {
      isRunning: this.isRunning,
      chatId: this.chatId,
      cronExpression: this.cronExpression,
      adminUserId: this.adminUserId
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Test method to verify cron is working
   */
  startTestSchedule(): void {
    logger.info('Starting test cron job (every minute for 5 minutes)');
    
    let testCount = 0;
    const maxTests = 5;
    
    const testTask = cron.schedule('* * * * *', () => {
      testCount++;
      logger.info(`Test cron job executed ${testCount}/${maxTests}`, {
        timestamp: new Date().toISOString()
      });
      
      if (testCount >= maxTests) {
        testTask.stop();
        logger.info('Test cron job completed - node-cron is working!');
      }
    }, {
      timezone: 'Europe/Rome'
    });
  }
}

// Export singleton instance  
export default new LeaderboardSchedulerService();