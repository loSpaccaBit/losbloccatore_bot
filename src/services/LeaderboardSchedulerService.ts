import * as cron from 'node-cron';
import { LeaderboardImageService } from './LeaderboardImageService';
import { TelegramService } from './TelegramService';
import logger from '../utils/logger';
import config from '../config';

export class LeaderboardSchedulerService {
  private isRunning: boolean = false;
  private scheduledTask: cron.ScheduledTask | null = null;
  private chatId: number;
  private cronExpression: string;
  private telegramService: TelegramService | null = null;
  private leaderboardImageService: LeaderboardImageService | null = null;

  constructor(chatId?: number, cronExpression?: string) {
    this.chatId = chatId || Number(config.channelId);
    // Default: every day at 18:00 (6 PM)
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

    logger.info('Starting leaderboard scheduler', {
      chatId: this.chatId,
      cronExpression: this.cronExpression,
      timezone: 'Europe/Rome'
    });

    this.scheduledTask = cron.schedule(
      this.cronExpression,
      async () => {
        await this.generateAndSendLeaderboard();
      },
      {
        timezone: 'Europe/Rome'
      }
    );

    this.isRunning = true;
    logger.info('Leaderboard scheduler started successfully');
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
      logger.info('Generating and sending scheduled leaderboard', { chatId: this.chatId });

      // Use the actual chatId (negative for channels) for database queries
      const dbChatId = this.chatId;

      // Generate the leaderboard image
      const imagePath = await this.getLeaderboardImageService().generateLeaderboardImage(dbChatId);

      // Get leaderboard data for the message text
      const leaderboardData = await this.getLeaderboardImageService().getLeaderboardData(dbChatId, 5);

      // Create message text with current standings
      let messageText: string;

      if (leaderboardData.length === 0) {
        messageText = '🏆 **CLASSIFICA** 🏆\n\n' +
          '🚀 Sii il primo a partecipare!\n' +
          '💫 Unisciti al canale e inizia a guadagnare punti!\n\n' +
          '🎯 Come partecipare:\n' +
          '• Visita il nostro TikTok per 3 punti\n' +
          '• Invita amici per 2 punti ciascuno\n\n' +
          '💪 La competizione ti aspetta!';
      } else {
        messageText = '🏆 **CLASSIFICA AGGIORNATA** 🏆\n\n';

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

        leaderboardData.forEach((participant, index) => {
          const medal = medals[index] || `${index + 1}️⃣`;
          messageText += `${medal} **${participant.username}** - ${participant.points} punti\n`;
        });

        messageText += '\n💪 Continua a partecipare per scalare la classifica!';
      }

      // Send the image with caption to the channel (using negative chatId)
      await this.getTelegramService().sendPhoto(
        this.chatId,
        imagePath,
        messageText
      );

      logger.info('Scheduled leaderboard sent successfully', {
        chatId: this.chatId,
        dbChatId,
        participantCount: leaderboardData.length,
        imagePath
      });

    } catch (error) {
      logger.error('Failed to generate and send scheduled leaderboard', error as Error, {
        chatId: this.chatId
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
  } {
    return {
      isRunning: this.isRunning,
      chatId: this.chatId,
      cronExpression: this.cronExpression
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance  
export default new LeaderboardSchedulerService();