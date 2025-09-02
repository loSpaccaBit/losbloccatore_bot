export interface TikTokClickData {
    userId: number;
    userName: string;
    clickedUrl: string;
    timestamp: Date;
    pointsAwarded: number;
}
export declare class TikTokService {
    private static instance;
    private prisma;
    constructor();
    static getInstance(): TikTokService;
    private getTikTokPoints;
    private getReferralPoints;
    processTikTokClick(userId: number, userName: string, clickedUrl: string): Promise<{
        success: boolean;
        pointsAwarded: number;
        totalPoints: number;
        newClick: boolean;
    }>;
    private recordTikTokClick;
    getUserTotalPoints(userId: number): Promise<number>;
    generateReferralLink(referralCode: string, channelUsername?: string): string;
    extractTikTokUrl(messageText: string): string | null;
    isTikTokUrl(url: string): boolean;
    getUserClickHistory(userId: number): Promise<TikTokClickData[]>;
    getLeaderboard(limit?: number): Promise<Array<{
        userId: number;
        totalPoints: number;
        clickCount: number;
    }>>;
    checkClickRateLimit(userId: number): boolean;
}
declare const _default: TikTokService;
export default _default;
//# sourceMappingURL=TikTokService.d.ts.map