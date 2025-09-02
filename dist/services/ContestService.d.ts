import { ContestParticipant } from '../models/ContestParticipant';
export declare class ContestService {
    private prisma;
    constructor();
    getOrCreateParticipant(userId: number, chatId: number, firstName: string, lastName?: string, username?: string, referralCode?: string): Promise<ContestParticipant>;
    findParticipantByReferralCode(referralCode: string): Promise<ContestParticipant | null>;
    completeTiktokTaskViaButton(userId: number, chatId: number): Promise<boolean>;
    handleTiktokSubmission(userId: number, chatId: number, tiktokLink: string): Promise<boolean>;
    handleUserLeft(userId: number, chatId: number): Promise<void>;
    getLeaderboard(chatId: number, limit?: number): Promise<ContestParticipant[]>;
    getPersonalLeaderboard(userId: number, chatId: number, range?: number): Promise<{
        userRank: number;
        userPoints: number;
        leaderboard: Array<{
            participant: ContestParticipant;
            rank: number;
        }>;
    }>;
    getParticipantRank(userId: number, chatId: number): Promise<number>;
    getParticipantStats(userId: number, chatId: number): Promise<ContestParticipant | null>;
    getUserPersonalStats(userId: number, chatId: number): Promise<ContestParticipant | null>;
    private generateReferralCode;
    private normalizeTiktokLink;
    private isValidTiktokLink;
    private sortParticipantsEquitably;
}
//# sourceMappingURL=ContestService.d.ts.map