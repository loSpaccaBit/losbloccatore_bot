import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import path from 'path';
import fs from 'fs';
import { ContestService } from './ContestService';
import logger from '../utils/logger';

export interface LeaderboardPosition {
  rank: number;
  username: string;
  points: number;
}

export class LeaderboardImageService {
  // Styling configuration constants
  private static readonly MAIN_TEXT_CONFIG = {
    fillStyle: '#FFFFFF',
    strokeStyle: '#000000',
    lineWidth: 2,
    font: 'bold 36px "Azeret Mono", monospace',
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { x: 2, y: 2 },
    shadowBlur: 4
  };

  private static readonly EMPTY_TEXT_CONFIG = {
    fillStyle: '#CCCCCC',
    strokeStyle: '#000000',
    lineWidth: 1.5,
    font: 'italic 24px "Azeret Mono", monospace',
    shadowColor: 'rgba(0, 0, 0, 0.4)',
    shadowOffset: { x: 1, y: 1 },
    shadowBlur: 3
  };

  private contestService: ContestService | null = null;
  private templatePath: string;
  private outputPath: string;

  constructor() {
    this.templatePath = path.join(process.cwd(), 'media', 'classifica.png');
    this.outputPath = path.join(process.cwd(), 'media', 'classifica_output.png');
  }

  private getContestService(): ContestService {
    if (!this.contestService) {
      this.contestService = new ContestService();
    }
    return this.contestService;
  }

  private applyTextStyle(ctx: CanvasRenderingContext2D, config: typeof LeaderboardImageService.MAIN_TEXT_CONFIG): void {
    ctx.fillStyle = config.fillStyle;
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth;
    ctx.font = config.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = config.shadowColor;
    ctx.shadowOffsetX = config.shadowOffset.x;
    ctx.shadowOffsetY = config.shadowOffset.y;
    ctx.shadowBlur = config.shadowBlur;
  }

  async generateLeaderboardImage(chatId: number): Promise<string> {
    try {
      logger.info('Starting leaderboard image generation', { chatId });

      // Get top 5 participants from leaderboard
      const topParticipants = await this.getContestService().getLeaderboard(chatId, 5);

      if (topParticipants.length === 0) {
        logger.info('No participants found, generating empty leaderboard', { chatId });
        return await this.generateEmptyLeaderboard();
      }

      // Load the template image
      const templateImage = await loadImage(this.templatePath);
      const canvas = createCanvas(templateImage.width, templateImage.height);
      const ctx = canvas.getContext('2d');

      // Draw the template
      ctx.drawImage(templateImage, 0, 0);

      // Define improved positions for each rank closer to left edge
      const positions = [
        { x: 190, y: 450, maxWidth: 500 }, // 1st place - closer to left edge
        { x: 190, y: 580, maxWidth: 500 }, // 2nd place  
        { x: 190, y: 710, maxWidth: 500 }, // 3rd place
        { x: 190, y: 840, maxWidth: 500 }, // 4th place
        { x: 190, y: 970, maxWidth: 500 }  // 5th place
      ];

      // Apply main text styling configuration
      this.applyTextStyle(ctx, LeaderboardImageService.MAIN_TEXT_CONFIG);

      // Create display names with priority: username > fullName > firstName > fallback
      const getDisplayName = (participant: any): string => {
        if (participant.username) {
          return `@${participant.username}`;
        }
        if (participant.lastName) {
          return `${participant.firstName} ${participant.lastName}`;
        }
        if (participant.firstName) {
          return participant.firstName;
        }
        return `Utente #${participant.userId}`;
      };

      // Draw each participant's name and points
      for (let i = 0; i < Math.min(topParticipants.length, 5); i++) {
        const participant = topParticipants[i];
        const position = positions[i];

        const displayName = getDisplayName(participant);
        const text = displayName;

        // Truncate text if it's too long
        const truncatedText = this.truncateText(ctx, text, position.maxWidth);

        // Draw text with outline and shadow for better visibility
        const textX = position.x;
        const textY = position.y;

        ctx.strokeText(truncatedText, textX, textY);
        ctx.fillText(truncatedText, textX, textY);

        logger.debug('Added participant to leaderboard image', {
          rank: i + 1,
          userId: participant.userId,
          username: participant.username || null,
          displayName,
          points: participant.points,
          x: position.x,
          y: position.y
        });
      }

      // Save the generated image
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(this.outputPath, buffer);

      logger.info('Leaderboard image generated successfully', {
        chatId,
        participantCount: topParticipants.length,
        outputPath: this.outputPath
      });

      return this.outputPath;

    } catch (error) {
      logger.error('Failed to generate leaderboard image', error as Error, { chatId });
      throw error;
    }
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      return text;
    }

    // Binary search for the right length
    let low = 0;
    let high = text.length;
    let result = text;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const truncated = text.substring(0, mid) + '...';
      const width = ctx.measureText(truncated).width;

      if (width <= maxWidth) {
        result = truncated;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  async getLeaderboardData(chatId: number, limit: number = 5): Promise<LeaderboardPosition[]> {
    try {
      const participants = await this.getContestService().getLeaderboard(chatId, limit);

      const getDisplayName = (participant: any): string => {
        if (participant.username) {
          return `@${participant.username}`;
        }
        if (participant.lastName) {
          return `${participant.firstName} ${participant.lastName}`;
        }
        if (participant.firstName) {
          return participant.firstName;
        }
        return `Utente #${participant.userId}`;
      };

      return participants.slice(0, limit).map((participant, index) => ({
        rank: index + 1,
        username: getDisplayName(participant),
        points: participant.points
      }));
    } catch (error) {
      logger.error('Failed to get leaderboard data', error as Error, { chatId, limit });
      throw error;
    }
  }

  getOutputPath(): string {
    return this.outputPath;
  }

  getTemplatePath(): string {
    return this.templatePath;
  }

  private async generateEmptyLeaderboard(): Promise<string> {
    try {
      // Load the template image
      const templateImage = await loadImage(this.templatePath);
      const canvas = createCanvas(templateImage.width, templateImage.height);
      const ctx = canvas.getContext('2d');

      // Draw the template
      ctx.drawImage(templateImage, 0, 0);

      // Define improved positions for empty leaderboard closer to left edge
      const positions = [
        { x: 50, y: 110, maxWidth: 500 }, // 1st place
        { x: 50, y: 155, maxWidth: 500 }, // 2nd place  
        { x: 50, y: 200, maxWidth: 500 }, // 3rd place
        { x: 50, y: 245, maxWidth: 500 }, // 4th place
        { x: 50, y: 290, maxWidth: 500 }  // 5th place
      ];

      // Apply empty text styling configuration
      this.applyTextStyle(ctx, LeaderboardImageService.EMPTY_TEXT_CONFIG);

      // Draw empty slots message
      for (let i = 0; i < 5; i++) {
        const position = positions[i];
        const text = 'Nessun partecipante ancora...';

        // Draw text with outline and shadow for better visibility
        const textX = position.x;
        const textY = position.y;

        ctx.strokeText(text, textX, textY);
        ctx.fillText(text, textX, textY);
      }

      // Save the generated image
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(this.outputPath, buffer);

      logger.info('Empty leaderboard image generated successfully', {
        outputPath: this.outputPath
      });

      return this.outputPath;

    } catch (error) {
      logger.error('Failed to generate empty leaderboard image', error as Error);
      throw error;
    }
  }
}

// Export class instead of singleton to avoid early database initialization
// export default new LeaderboardImageService();