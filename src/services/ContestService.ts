import { PrismaClient, ReferralStatus } from '@prisma/client';
import database from '../database/connection';
import { ContestParticipant, ContestParticipantData } from '../models/ContestParticipant';
import messageService from './MessageService';
import logger from '../utils/logger';

export class ContestService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = database.getPrisma();
  }

  async getOrCreateParticipant(
    userId: number,
    chatId: number,
    firstName: string,
    lastName?: string,
    username?: string,
    referralCode?: string
  ): Promise<ContestParticipant> {
    let prismaParticipant = await this.prisma.contestParticipant.findFirst({
      where: { 
        userId: BigInt(userId),
        chatId: BigInt(chatId)
      }
    });

    if (!prismaParticipant) {
      const newReferralCode = this.generateReferralCode(userId);
      
      // Get TikTok URL from settings to initialize the field
      const tiktokUrl = await messageService.getSetting('TIKTOK_URL', 'https://www.tiktok.com/@lo_sbloccatore');
      
      const participantData: ContestParticipantData = {
        userId: BigInt(userId),
        chatId: BigInt(chatId),
        firstName,
        lastName: lastName || undefined,
        username: username || undefined,
        referralCode: newReferralCode,
        points: 0,
        tiktokTaskCompleted: false,
        tiktokLinks: JSON.stringify([tiktokUrl]), // Initialize with actual TikTok URL
        referralCount: 0,
        isActive: true
      };

      if (referralCode) {
        logger.info('Processing referral code', { userId, chatId, referralCode });
        
        // Primary: Try to find referrer by referralCode (this should be the main method now)
        let referrer = await this.findParticipantByReferralCode(referralCode);
        logger.info('Referrer search by referralCode result', { referralCode, found: !!referrer });
        
        // Fallback: If not found and referralCode is numeric, try by userId for backward compatibility
        if (!referrer && /^\d+$/.test(referralCode)) {
          const referrerUserId = BigInt(referralCode);
          logger.info('Referral code is numeric, trying fallback search by userId', { 
            referrerUserId: referrerUserId.toString(), 
            chatId,
            note: 'This is backward compatibility for old links'
          });
          
          const prismaReferrer = await this.prisma.contestParticipant.findFirst({
            where: { 
              userId: referrerUserId,
              chatId: BigInt(chatId) // Must be in the same chat
            }
          });
          
          if (prismaReferrer) {
            referrer = new ContestParticipant(prismaReferrer);
            logger.info('Referrer found via userId fallback', { 
              referrerId: prismaReferrer.id, 
              referrerUserId: prismaReferrer.userId.toString(),
              referrerName: prismaReferrer.firstName,
              note: 'Consider updating link to use referralCode'
            });
          } else {
            logger.warn('Referrer not found by userId fallback', { 
              referrerUserId: referrerUserId.toString(), 
              chatId 
            });
          }
        }
        
        // If still not found
        if (!referrer) {
          logger.warn('Referrer not found by any method', { 
            referralCode, 
            isNumeric: /^\d+$/.test(referralCode),
            chatId 
          });
        }

        if (referrer) {
          logger.info('Creating referral relationship', {
            referrerId: referrer.userId.toString(),
            referredUserId: userId,
            chatId
          });
          participantData.referredBy = referrer.userId;
          
          await this.prisma.contestReferral.create({
            data: {
              referrerId: referrer.userId,
              referredUserId: BigInt(userId),
              chatId: BigInt(chatId),
              status: ReferralStatus.ACTIVE,
              pointsAwarded: 2
            }
          });

          // Update referrer points using userId and chatId since we might not have reliable id
          // First check if this is their first referral point
          const currentReferrer = await this.prisma.contestParticipant.findFirst({
            where: { 
              userId: referrer.userId,
              chatId: BigInt(chatId)
            }
          });

          const updateData: any = {
            points: { increment: 2 },
            referralCount: { increment: 1 }
          };

          // Set firstReferralPointAt if this is their first referral point
          if (currentReferrer && !currentReferrer.firstReferralPointAt) {
            updateData.firstReferralPointAt = new Date();
          }

          const updateResult = await this.prisma.contestParticipant.updateMany({
            where: { 
              userId: referrer.userId,
              chatId: BigInt(chatId)
            },
            data: updateData
          });
          
          logger.info('Referrer points updated', {
            referrerId: referrer.userId.toString(),
            updatedCount: updateResult.count,
            pointsAwarded: 2
          });
        }
      }

      const createData: any = {
        userId: participantData.userId,
        username: participantData.username || null,
        firstName: participantData.firstName,
        lastName: participantData.lastName || null,
        chatId: participantData.chatId,
        points: participantData.points,
        tiktokTaskCompleted: participantData.tiktokTaskCompleted,
        referralCode: participantData.referralCode,
        referralCount: participantData.referralCount,
        isActive: participantData.isActive
      };

      if (participantData.referredBy) {
        createData.referredBy = participantData.referredBy;
      }
      if (participantData.tiktokLinks) {
        createData.tiktokLinks = participantData.tiktokLinks;
      }

      prismaParticipant = await this.prisma.contestParticipant.create({
        data: createData
      });
      logger.info('New contest participant created', {
        userId,
        chatId,
        referralCode: newReferralCode,
        referredBy: participantData.referredBy
      });
    } else {
      // User exists but might be inactive - reactivate them
      if (!prismaParticipant.isActive) {
        await this.prisma.contestParticipant.update({
          where: { id: prismaParticipant.id },
          data: { 
            isActive: true,
            // Update their info in case it changed
            firstName,
            lastName: lastName || null,
            username: username || null
          }
        });
        logger.info('Reactivated existing contest participant', {
          userId,
          chatId,
          participantId: prismaParticipant.id
        });
      }
    }

    return new ContestParticipant(prismaParticipant);
  }

  async findParticipantByReferralCode(referralCode: string): Promise<ContestParticipant | null> {
    const participant = await this.prisma.contestParticipant.findUnique({
      where: { referralCode }
    });
    return participant ? new ContestParticipant(participant) : null;
  }

  /**
   * Complete TikTok task via button click (no URL validation needed)
   */
  async completeTiktokTaskViaButton(userId: number, chatId: number): Promise<boolean> {
    try {
      const prismaParticipant = await this.prisma.contestParticipant.findFirst({
        where: { 
          userId: BigInt(userId), 
          chatId: BigInt(chatId) 
        }
      });

      if (!prismaParticipant) {
        logger.warn('Participant not found for TikTok button completion', { userId, chatId });
        return false;
      }

      // Check if task already completed
      if (prismaParticipant.tiktokTaskCompleted) {
        logger.info('TikTok task already completed via button', { userId, chatId });
        return false;
      }

      // Award points and mark task as completed
      await this.prisma.contestParticipant.update({
        where: { id: prismaParticipant.id },
        data: {
          tiktokTaskCompleted: true,
          points: { increment: 3 }
        }
      });

      logger.info('TikTok task completed via button click', {
        userId,
        chatId,
        pointsAwarded: 3,
        method: 'button_click'
      });

      return true;

    } catch (error) {
      logger.error('Failed to complete TikTok task via button', error as Error, { userId, chatId });
      return false;
    }
  }

  async handleTiktokSubmission(userId: number, chatId: number, tiktokLink: string): Promise<boolean> {
    const prismaParticipant = await this.prisma.contestParticipant.findFirst({
      where: { 
        userId: BigInt(userId), 
        chatId: BigInt(chatId) 
      }
    });

    if (!prismaParticipant) {
      logger.warn('Participant not found for TikTok submission', { userId, chatId });
      return false;
    }

    const participant = new ContestParticipant(prismaParticipant);
    logger.info('Processing TikTok submission', {
      userId,
      chatId,
      currentTaskCompleted: participant.tiktokTaskCompleted,
      currentPoints: participant.points,
      currentLinks: participant.parsedTiktokLinks.length
    });

    const normalizedLink = this.normalizeTiktokLink(tiktokLink);
    if (!normalizedLink || !this.isValidTiktokLink(normalizedLink)) {
      logger.warn('Invalid TikTok link', { userId, tiktokLink, normalizedLink });
      return false;
    }

    const existingLinks = participant.parsedTiktokLinks;
    if (existingLinks.includes(normalizedLink)) {
      logger.info('TikTok link already clicked by user', { userId, normalizedLink });
      return false;
    }

    participant.addTiktokLink(normalizedLink);
    
    const updateData: any = {
      tiktokLinks: participant.tiktokLinks
    };
    
    const wasTaskCompleted = participant.tiktokTaskCompleted;
    if (!participant.tiktokTaskCompleted) {
      updateData.tiktokTaskCompleted = true;
      updateData.points = { increment: 3 };
      logger.info('First TikTok task - marking as completed and awarding 3 points', { userId });
    } else {
      // Give points for additional TikTok clicks even if task was already completed
      updateData.points = { increment: 3 };
      logger.info('Additional TikTok click - awarding 3 points', { userId });
    }

    await this.prisma.contestParticipant.update({
      where: { id: prismaParticipant.id },
      data: updateData
    });

    logger.info('TikTok submission processed successfully', {
      userId,
      chatId,
      tiktokLink: normalizedLink,
      wasTaskCompleted,
      newTaskCompleted: !wasTaskCompleted,
      pointsAwarded: 3,
      newTotalPoints: participant.points + 3
    });

    return true;
  }

  async handleUserLeft(userId: number, chatId: number): Promise<void> {
    const participant = await this.prisma.contestParticipant.findFirst({
      where: { 
        userId: BigInt(userId), 
        chatId: BigInt(chatId) 
      }
    });

    if (participant) {
      await this.prisma.contestParticipant.update({
        where: { id: participant.id },
        data: { isActive: false }
      });
    }

    const referrals = await this.prisma.contestReferral.findMany({
      where: { 
        referredUserId: BigInt(userId), 
        chatId: BigInt(chatId),
        status: ReferralStatus.ACTIVE 
      }
    });

    for (const referral of referrals) {
      await this.prisma.contestReferral.update({
        where: { id: referral.id },
        data: {
          status: ReferralStatus.LEFT,
          leftAt: new Date()
        }
      });

      await this.prisma.contestParticipant.updateMany({
        where: { 
          userId: referral.referrerId, 
          chatId: BigInt(chatId) 
        },
        data: {
          points: { decrement: referral.pointsAwarded },
          referralCount: { decrement: 1 }
        }
      });

      logger.info('Referral points revoked', {
        referrerId: Number(referral.referrerId),
        referredUserId: userId,
        pointsRevoked: referral.pointsAwarded
      });
    }
  }

  async getLeaderboard(chatId: number, limit: number = 10): Promise<ContestParticipant[]> {
    const participants = await this.prisma.contestParticipant.findMany({
      where: { 
        chatId: BigInt(chatId), 
        isActive: true 
      }
    });
    
    // Apply equitable ranking system with tiebreakers
    const sortedParticipants = this.sortParticipantsEquitably(participants);
    
    return sortedParticipants.slice(0, limit).map(p => new ContestParticipant(p));
  }

  /**
   * Get personal leaderboard showing user's position and nearby participants
   */
  async getPersonalLeaderboard(userId: number, chatId: number, range: number = 5): Promise<{
    userRank: number;
    userPoints: number;
    leaderboard: Array<{ participant: ContestParticipant; rank: number }>
  }> {
    // Get user's current stats
    const userParticipant = await this.prisma.contestParticipant.findFirst({
      where: { 
        userId: BigInt(userId), 
        chatId: BigInt(chatId),
        isActive: true
      }
    });

    if (!userParticipant) {
      return {
        userRank: 0,
        userPoints: 0,
        leaderboard: []
      };
    }

    // Get user's rank
    const userRank = await this.getParticipantRank(userId, chatId);
    
    // Calculate bounds for nearby participants
    const startRank = Math.max(1, userRank - range);
    const endRank = userRank + range;
    
    // Get all participants and sort them equitably
    const allParticipants = await this.prisma.contestParticipant.findMany({
      where: { 
        chatId: BigInt(chatId), 
        isActive: true 
      }
    });
    
    // Apply equitable ranking system
    const sortedParticipants = this.sortParticipantsEquitably(allParticipants);
    const contestParticipants = sortedParticipants.map(p => new ContestParticipant(p));
    
    // Get participants in the range
    const startIndex = Math.max(0, startRank - 1);
    const endIndex = Math.min(contestParticipants.length, endRank);
    const nearbyParticipants = contestParticipants.slice(startIndex, endIndex);
    
    // Create leaderboard with ranks
    const leaderboard = nearbyParticipants.map((participant, index) => ({
      participant,
      rank: startIndex + index + 1
    }));
    
    return {
      userRank,
      userPoints: userParticipant.points,
      leaderboard
    };
  }

  async getParticipantRank(userId: number, chatId: number): Promise<number> {
    const participant = await this.prisma.contestParticipant.findFirst({
      where: { 
        userId: BigInt(userId), 
        chatId: BigInt(chatId) 
      }
    });

    if (!participant) {
      return 0;
    }

    // Get all participants and sort them equitably
    const allParticipants = await this.prisma.contestParticipant.findMany({
      where: { 
        chatId: BigInt(chatId), 
        isActive: true 
      }
    });

    const sortedParticipants = this.sortParticipantsEquitably(allParticipants);
    
    // Find the user's position in the sorted list
    const rank = sortedParticipants.findIndex(p => p.userId === participant.userId) + 1;
    
    return rank || 0;
  }

  async getParticipantStats(userId: number, chatId: number): Promise<ContestParticipant | null> {
    const participant = await this.prisma.contestParticipant.findFirst({
      where: { 
        userId: BigInt(userId), 
        chatId: BigInt(chatId) 
      }
    });
    return participant ? new ContestParticipant(participant) : null;
  }

  /**
   * Get user's personal contest stats without leaderboard position
   */
  async getUserPersonalStats(userId: number, chatId: number): Promise<ContestParticipant | null> {
    return this.getParticipantStats(userId, chatId);
  }

  private generateReferralCode(userId: number): string {
    const timestamp = Date.now().toString(36);
    const userIdHex = userId.toString(16);
    return `REF${timestamp}${userIdHex}`.toUpperCase().substring(0, 15);
  }

  private normalizeTiktokLink(link: string): string | null {
    try {
      const url = new URL(link);
      if (url.hostname.includes('tiktok.com') || url.hostname.includes('vm.tiktok.com')) {
        return url.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  private isValidTiktokLink(link: string): boolean {
    const tiktokPatterns = [
      /https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /https?:\/\/vm\.tiktok\.com\/[\w]+/,
      /https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/
    ];

    return tiktokPatterns.some(pattern => pattern.test(link));
  }

  /**
   * Sort participants using equitable ranking system with tiebreakers:
   * 1. Points (descending)
   * 2. First referral timestamp (ascending - earlier is better)
   * 3. Referral count (descending)
   * 4. Join date (ascending - earlier is better)
   */
  private sortParticipantsEquitably(participants: any[]): any[] {
    return participants.sort((a, b) => {
      // 1. Primary: Points (descending)
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      // 2. First referral timestamp tiebreaker
      // Users without referrals go after users with referrals
      if (!a.firstReferralPointAt && b.firstReferralPointAt) return 1;
      if (a.firstReferralPointAt && !b.firstReferralPointAt) return -1;

      // Among users with referrals, earlier first referral is better
      if (a.firstReferralPointAt && b.firstReferralPointAt) {
        const timeDiff = a.firstReferralPointAt.getTime() - b.firstReferralPointAt.getTime();
        if (timeDiff !== 0) return timeDiff;
      }

      // 3. Referral count tiebreaker (descending)
      if (b.referralCount !== a.referralCount) {
        return b.referralCount - a.referralCount;
      }

      // 4. Final tiebreaker: Join date (ascending - earlier is better)
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
  }
}