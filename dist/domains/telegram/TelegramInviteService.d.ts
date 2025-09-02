import { TelegramCoreService } from './TelegramCoreService';
export declare class TelegramInviteService {
    private coreService;
    constructor(coreService: TelegramCoreService);
    createChannelInviteLink(chatId: number, name?: string, expireDate?: number, memberLimit?: number): Promise<string | null>;
    getReferralInviteLink(referralCode: string): Promise<string | null>;
    revokeInviteLink(chatId: number, inviteLink: string): Promise<boolean>;
    getChatInviteLinks(chatId: number): Promise<any[]>;
    exportChatInviteLink(chatId: number): Promise<string | null>;
    cleanupExpiredReferralLinks(): Promise<number>;
    getCachedReferralLink(referralCode: string): string | null;
    clearCachedReferralLink(referralCode: string): void;
    getReferralLinkStats(): {
        totalCached: number;
        cacheHitRate: number;
    };
}
//# sourceMappingURL=TelegramInviteService.d.ts.map