"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContestService = void 0;
const client_1 = require("@prisma/client");
const connection_1 = __importDefault(require("../database/connection"));
const ContestParticipant_1 = require("../models/ContestParticipant");
const MessageService_1 = __importDefault(require("./MessageService"));
const logger_1 = __importDefault(require("../utils/logger"));
class ContestService {
    constructor() {
        this.prisma = connection_1.default.getPrisma();
    }
    async getOrCreateParticipant(userId, chatId, firstName, lastName, username, referralCode) {
        let prismaParticipant = await this.prisma.contestParticipant.findFirst({
            where: {
                userId: BigInt(userId),
                chatId: BigInt(chatId)
            }
        });
        if (!prismaParticipant) {
            const newReferralCode = this.generateReferralCode(userId);
            const tiktokUrl = await MessageService_1.default.getSetting('TIKTOK_URL', 'https://www.tiktok.com/@lo_sbloccatore');
            const participantData = {
                userId: BigInt(userId),
                chatId: BigInt(chatId),
                firstName,
                lastName: lastName || undefined,
                username: username || undefined,
                referralCode: newReferralCode,
                points: 0,
                tiktokTaskCompleted: false,
                tiktokLinks: JSON.stringify([tiktokUrl]),
                referralCount: 0,
                isActive: true
            };
            if (referralCode) {
                logger_1.default.info('Processing referral code', { userId, chatId, referralCode });
                let referrer = await this.findParticipantByReferralCode(referralCode);
                logger_1.default.info('Referrer search by referralCode result', { referralCode, found: !!referrer });
                if (!referrer && /^\d+$/.test(referralCode)) {
                    const referrerUserId = BigInt(referralCode);
                    logger_1.default.info('Referral code is numeric, trying fallback search by userId', {
                        referrerUserId: referrerUserId.toString(),
                        chatId,
                        note: 'This is backward compatibility for old links'
                    });
                    const prismaReferrer = await this.prisma.contestParticipant.findFirst({
                        where: {
                            userId: referrerUserId,
                            chatId: BigInt(chatId)
                        }
                    });
                    if (prismaReferrer) {
                        referrer = new ContestParticipant_1.ContestParticipant(prismaReferrer);
                        logger_1.default.info('Referrer found via userId fallback', {
                            referrerId: prismaReferrer.id,
                            referrerUserId: prismaReferrer.userId.toString(),
                            referrerName: prismaReferrer.firstName,
                            note: 'Consider updating link to use referralCode'
                        });
                    }
                    else {
                        logger_1.default.warn('Referrer not found by userId fallback', {
                            referrerUserId: referrerUserId.toString(),
                            chatId
                        });
                    }
                }
                if (!referrer) {
                    logger_1.default.warn('Referrer not found by any method', {
                        referralCode,
                        isNumeric: /^\d+$/.test(referralCode),
                        chatId
                    });
                }
                if (referrer) {
                    logger_1.default.info('Creating referral relationship', {
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
                            status: client_1.ReferralStatus.ACTIVE,
                            pointsAwarded: 2
                        }
                    });
                    const currentReferrer = await this.prisma.contestParticipant.findFirst({
                        where: {
                            userId: referrer.userId,
                            chatId: BigInt(chatId)
                        }
                    });
                    const updateData = {
                        points: { increment: 2 },
                        referralCount: { increment: 1 }
                    };
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
                    logger_1.default.info('Referrer points updated', {
                        referrerId: referrer.userId.toString(),
                        updatedCount: updateResult.count,
                        pointsAwarded: 2
                    });
                }
            }
            const createData = {
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
            logger_1.default.info('New contest participant created', {
                userId,
                chatId,
                referralCode: newReferralCode,
                referredBy: participantData.referredBy
            });
        }
        else {
            if (!prismaParticipant.isActive) {
                await this.prisma.contestParticipant.update({
                    where: { id: prismaParticipant.id },
                    data: {
                        isActive: true,
                        firstName,
                        lastName: lastName || null,
                        username: username || null
                    }
                });
                logger_1.default.info('Reactivated existing contest participant', {
                    userId,
                    chatId,
                    participantId: prismaParticipant.id
                });
            }
        }
        return new ContestParticipant_1.ContestParticipant(prismaParticipant);
    }
    async findParticipantByReferralCode(referralCode) {
        const participant = await this.prisma.contestParticipant.findUnique({
            where: { referralCode }
        });
        return participant ? new ContestParticipant_1.ContestParticipant(participant) : null;
    }
    async completeTiktokTaskViaButton(userId, chatId) {
        try {
            const prismaParticipant = await this.prisma.contestParticipant.findFirst({
                where: {
                    userId: BigInt(userId),
                    chatId: BigInt(chatId)
                }
            });
            if (!prismaParticipant) {
                logger_1.default.warn('Participant not found for TikTok button completion', { userId, chatId });
                return false;
            }
            if (prismaParticipant.tiktokTaskCompleted) {
                logger_1.default.info('TikTok task already completed via button', { userId, chatId });
                return false;
            }
            await this.prisma.contestParticipant.update({
                where: { id: prismaParticipant.id },
                data: {
                    tiktokTaskCompleted: true,
                    points: { increment: 3 }
                }
            });
            logger_1.default.info('TikTok task completed via button click', {
                userId,
                chatId,
                pointsAwarded: 3,
                method: 'button_click'
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to complete TikTok task via button', error, { userId, chatId });
            return false;
        }
    }
    async handleTiktokSubmission(userId, chatId, tiktokLink) {
        const prismaParticipant = await this.prisma.contestParticipant.findFirst({
            where: {
                userId: BigInt(userId),
                chatId: BigInt(chatId)
            }
        });
        if (!prismaParticipant) {
            logger_1.default.warn('Participant not found for TikTok submission', { userId, chatId });
            return false;
        }
        const participant = new ContestParticipant_1.ContestParticipant(prismaParticipant);
        logger_1.default.info('Processing TikTok submission', {
            userId,
            chatId,
            currentTaskCompleted: participant.tiktokTaskCompleted,
            currentPoints: participant.points,
            currentLinks: participant.parsedTiktokLinks.length
        });
        const normalizedLink = this.normalizeTiktokLink(tiktokLink);
        if (!normalizedLink || !this.isValidTiktokLink(normalizedLink)) {
            logger_1.default.warn('Invalid TikTok link', { userId, tiktokLink, normalizedLink });
            return false;
        }
        const existingLinks = participant.parsedTiktokLinks;
        if (existingLinks.includes(normalizedLink)) {
            logger_1.default.info('TikTok link already clicked by user', { userId, normalizedLink });
            return false;
        }
        participant.addTiktokLink(normalizedLink);
        const updateData = {
            tiktokLinks: participant.tiktokLinks
        };
        const wasTaskCompleted = participant.tiktokTaskCompleted;
        if (!participant.tiktokTaskCompleted) {
            updateData.tiktokTaskCompleted = true;
            updateData.points = { increment: 3 };
            logger_1.default.info('First TikTok task - marking as completed and awarding 3 points', { userId });
        }
        else {
            updateData.points = { increment: 3 };
            logger_1.default.info('Additional TikTok click - awarding 3 points', { userId });
        }
        await this.prisma.contestParticipant.update({
            where: { id: prismaParticipant.id },
            data: updateData
        });
        logger_1.default.info('TikTok submission processed successfully', {
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
    async handleUserLeft(userId, chatId) {
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
                status: client_1.ReferralStatus.ACTIVE
            }
        });
        for (const referral of referrals) {
            await this.prisma.contestReferral.update({
                where: { id: referral.id },
                data: {
                    status: client_1.ReferralStatus.LEFT,
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
            logger_1.default.info('Referral points revoked', {
                referrerId: Number(referral.referrerId),
                referredUserId: userId,
                pointsRevoked: referral.pointsAwarded
            });
        }
    }
    async getLeaderboard(chatId, limit = 10) {
        const participants = await this.prisma.contestParticipant.findMany({
            where: {
                chatId: BigInt(chatId),
                isActive: true
            }
        });
        const sortedParticipants = this.sortParticipantsEquitably(participants);
        return sortedParticipants.slice(0, limit).map(p => new ContestParticipant_1.ContestParticipant(p));
    }
    async getPersonalLeaderboard(userId, chatId, range = 5) {
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
        const userRank = await this.getParticipantRank(userId, chatId);
        const startRank = Math.max(1, userRank - range);
        const endRank = userRank + range;
        const allParticipants = await this.prisma.contestParticipant.findMany({
            where: {
                chatId: BigInt(chatId),
                isActive: true
            }
        });
        const sortedParticipants = this.sortParticipantsEquitably(allParticipants);
        const contestParticipants = sortedParticipants.map(p => new ContestParticipant_1.ContestParticipant(p));
        const startIndex = Math.max(0, startRank - 1);
        const endIndex = Math.min(contestParticipants.length, endRank);
        const nearbyParticipants = contestParticipants.slice(startIndex, endIndex);
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
    async getParticipantRank(userId, chatId) {
        const participant = await this.prisma.contestParticipant.findFirst({
            where: {
                userId: BigInt(userId),
                chatId: BigInt(chatId)
            }
        });
        if (!participant) {
            return 0;
        }
        const allParticipants = await this.prisma.contestParticipant.findMany({
            where: {
                chatId: BigInt(chatId),
                isActive: true
            }
        });
        const sortedParticipants = this.sortParticipantsEquitably(allParticipants);
        const rank = sortedParticipants.findIndex(p => p.userId === participant.userId) + 1;
        return rank || 0;
    }
    async getParticipantStats(userId, chatId) {
        const participant = await this.prisma.contestParticipant.findFirst({
            where: {
                userId: BigInt(userId),
                chatId: BigInt(chatId)
            }
        });
        return participant ? new ContestParticipant_1.ContestParticipant(participant) : null;
    }
    async getUserPersonalStats(userId, chatId) {
        return this.getParticipantStats(userId, chatId);
    }
    generateReferralCode(userId) {
        const timestamp = Date.now().toString(36);
        const userIdHex = userId.toString(16);
        return `REF${timestamp}${userIdHex}`.toUpperCase().substring(0, 15);
    }
    normalizeTiktokLink(link) {
        try {
            const url = new URL(link);
            if (url.hostname.includes('tiktok.com') || url.hostname.includes('vm.tiktok.com')) {
                return url.href;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    isValidTiktokLink(link) {
        const tiktokPatterns = [
            /https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /https?:\/\/vm\.tiktok\.com\/[\w]+/,
            /https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/
        ];
        return tiktokPatterns.some(pattern => pattern.test(link));
    }
    sortParticipantsEquitably(participants) {
        return participants.sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            if (!a.firstReferralPointAt && b.firstReferralPointAt)
                return 1;
            if (a.firstReferralPointAt && !b.firstReferralPointAt)
                return -1;
            if (a.firstReferralPointAt && b.firstReferralPointAt) {
                const timeDiff = a.firstReferralPointAt.getTime() - b.firstReferralPointAt.getTime();
                if (timeDiff !== 0)
                    return timeDiff;
            }
            if (b.referralCount !== a.referralCount) {
                return b.referralCount - a.referralCount;
            }
            return a.joinedAt.getTime() - b.joinedAt.getTime();
        });
    }
}
exports.ContestService = ContestService;
//# sourceMappingURL=ContestService.js.map